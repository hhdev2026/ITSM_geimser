require 'base64'
require 'json'
require 'openssl'
require 'securerandom'
require 'uri'

class GeimserMeshLoginController < ApplicationController
  before_action :authentication_check

  def show
    key = mesh_login_key
    return render plain: 'Remote access is not configured.', status: :service_unavailable if key.blank?

    redirect_to mesh_target_url(mesh_login_token(key)), allow_other_host: true
  end

  def assets
    records = sync_remote_assets
    render json: {
      synced_at: Time.now.utc.iso8601,
      count: records.length,
      assets: records.map { |record| serialize_remote_asset(record) },
    }
  end

  private

  REMOTE_ASSETS_TABLE = :geimser_remote_assets
  MESH_DB_PATH = '/opt/meshcentral/meshcentral-data/meshcentral.db'

  class RemoteAsset < ActiveRecord::Base
    self.table_name = 'geimser_remote_assets'
  end

  def mesh_login_key
    key = ENV['MESH_LOGIN_KEY'].to_s.strip
    return if key !~ /\A[0-9a-f]{160}\z/i

    [key].pack('H*')
  end

  def mesh_login_token(key)
    payload = {
      u:    "user//#{ENV.fetch('MESH_LOGIN_USER', 'admin')}",
      a:    3,
      time: Time.now.to_i,
    }

    cipher = OpenSSL::Cipher.new('aes-256-gcm')
    cipher.encrypt
    iv = SecureRandom.random_bytes(12)
    cipher.key = key.byteslice(0, 32)
    cipher.iv = iv

    encrypted = cipher.update(payload.to_json) + cipher.final
    Base64.strict_encode64(iv + cipher.auth_tag + encrypted).tr('+/', '@$')
  end

  def mesh_target_url(login)
    public_url = ENV.fetch('MESH_PUBLIC_URL') do
      "https://#{ENV.fetch('MESH_HOSTNAME', 'remoto.geimser.cl')}"
    end

    uri = URI.parse(public_url)
    uri.path = safe_next_path
    uri.query = URI.encode_www_form('login' => login)
    uri.to_s
  end

  def safe_next_path
    requested = params[:next].to_s
    return '/' if requested.blank?

    uri = URI.parse(requested)
    return '/' if uri.host.present? || uri.scheme.present?

    uri.path.presence || '/'
  rescue URI::InvalidURIError
    '/'
  end

  def sync_remote_assets
    ensure_remote_assets_table

    devices = mesh_devices
    now = Time.now.utc

    devices.each do |device|
      attrs = {
        mesh_group_id: device[:mesh_group_id],
        group_name: device[:group_name],
        name: device[:name],
        hostname: device[:hostname],
        os_name: device[:os_name],
        ip_address: device[:ip_address],
        status: device[:status],
        last_seen_at: device[:last_seen_at],
        session_url: mesh_login_path_for(device[:mesh_node_id]),
        raw: device[:raw].to_json,
        updated_at: now,
      }

      record = RemoteAsset.find_or_initialize_by(mesh_node_id: device[:mesh_node_id])
      attrs[:created_at] = now if record.new_record?
      record.assign_attributes(attrs)
      record.save!
    end

    RemoteAsset.order(Arel.sql("CASE WHEN status = 'online' THEN 0 ELSE 1 END"), :group_name, :name).to_a
  end

  def ensure_remote_assets_table
    return if ActiveRecord::Base.connection.table_exists?(REMOTE_ASSETS_TABLE)

    ActiveRecord::Base.connection.create_table(REMOTE_ASSETS_TABLE) do |table|
      table.string :mesh_node_id, null: false
      table.string :mesh_group_id
      table.string :group_name
      table.string :name
      table.string :hostname
      table.string :os_name
      table.string :ip_address
      table.string :status
      table.datetime :last_seen_at
      table.string :session_url
      table.text :raw
      table.timestamps null: false
    end

    ActiveRecord::Base.connection.add_index(
      REMOTE_ASSETS_TABLE,
      :mesh_node_id,
      unique: true,
      name: 'idx_geimser_remote_assets_node'
    )
  end

  def mesh_devices
    return [] unless File.exist?(MESH_DB_PATH)

    rows = File.readlines(MESH_DB_PATH, chomp: true).filter_map do |line|
      JSON.parse(line)
    rescue JSON::ParserError
      nil
    end

    groups = rows
      .select { |row| row['type'] == 'mesh' }
      .each_with_object({}) { |row, memo| memo[row['_id']] = row['name'].presence || row['_id'] }
    sysinfo = mesh_sysinfo_by_node(rows)

    merged_mesh_nodes(rows)
      .map { |row| mesh_device_from_row(row, groups, sysinfo[row['_id']]) }
  end

  def merged_mesh_nodes(rows)
    rows
      .select { |row| row['type'] == 'node' && row['_id'].present? }
      .each_with_object({}) do |row, memo|
        id = row['_id']
        current = memo[id] || {}
        current['_geimser_seen_online'] = true if row['conn'].to_i.positive?
        current['_geimser_seen_times'] ||= []
        current['_geimser_seen_times'] += [row['lastconnect'], row['lastping'], row['firstconnect']]
        memo[id] = current.merge(row.compact)
      end
      .values
  end

  def mesh_device_from_row(row, groups, sysinfo)
    node_id = row['_id'].to_s
    mesh_group_id = row['meshid'].to_s.presence
    last_seen = remote_last_seen(row, sysinfo)
    name = row['name'].presence || row['rname'].presence || row['host'].presence || node_id.split('/').last
    system = sysinfo.to_h['system'].to_h

    {
      mesh_node_id: node_id,
      mesh_group_id: mesh_group_id,
      group_name: groups[mesh_group_id] || 'Sin grupo',
      name: name,
      hostname: row['host'].presence || row['rname'].presence || row['name'].presence || system['Name'].presence,
      os_name: remote_os_name(row, sysinfo),
      ip_address: remote_ip_address(row, sysinfo),
      status: remote_online?(row, last_seen) ? 'online' : 'offline',
      last_seen_at: last_seen,
      raw: row.merge('sysinfo' => sysinfo),
    }
  end

  def mesh_sysinfo_by_node(rows)
    rows
      .select { |row| row['type'] == 'sysinfo' && row['_id'].to_s.start_with?('sinode//') }
      .each_with_object({}) do |row, memo|
        memo[row['_id'].sub('sinode//', 'node//')] = row
      end
  end

  def remote_online?(row, last_seen)
    return true if row['_geimser_seen_online']
    return true if row['conn'].to_i.positive?

    # Mesh stores live connection in-memory and periodically writes inventory.
    # A very recent inventory touch is the best durable signal available here.
    last_seen.present? && last_seen >= 15.minutes.ago
  end

  def remote_last_seen(row, sysinfo)
    [
      row['lastconnect'],
      row['lastping'],
      row['firstconnect'],
      *Array(row['_geimser_seen_times']),
      sysinfo.to_h['time'],
    ].filter_map { |value| remote_time(value) }.max
  end

  def remote_os_name(row, sysinfo)
    osinfo = sysinfo.to_h['osinfo'].to_h
    caption = osinfo['Caption'].presence
    version = osinfo['Version'].presence
    build = osinfo['BuildNumber'].presence

    [
      row['osdesc'].presence,
      [caption, version, build].compact_blank.join(' - ').presence,
      row.dig('agent', 'osdesc').presence,
      row.dig('agent', 'caps').to_s.presence,
    ].compact_blank.first
  end

  def remote_ip_address(row, sysinfo)
    network = sysinfo.to_h['network'].to_h
    candidate = Array(row['iploc']).first.presence ||
      Array(network['netif']).filter_map { |iface| iface['ip'].presence }.first ||
      row['lastaddr'].to_s.split(':').first.presence

    candidate
  end

  def remote_time(value)
    return if value.blank?

    numeric = value.to_i
    return if numeric <= 0

    numeric > 99_999_999_999 ? Time.at(numeric / 1000).utc : Time.at(numeric).utc
  rescue StandardError
    nil
  end

  def mesh_login_path_for(_node_id)
    "/geimser/mesh/login?next=#{URI.encode_www_form_component('/')}"
  end

  def serialize_remote_asset(record)
    {
      id: record.mesh_node_id,
      group: record.group_name,
      name: record.name,
      hostname: record.hostname,
      os: record.os_name,
      ip: record.ip_address,
      status: record.status,
      last_seen_at: record.last_seen_at&.iso8601,
      session_url: record.session_url,
      updated_at: record.updated_at&.iso8601,
    }
  end
end
