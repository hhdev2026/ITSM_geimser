require 'json'
require 'uri'

class GeimserMeshCmdb
  MESH_DB_PATH = '/opt/meshcentral/meshcentral-data/meshcentral.db'
  REMOTE_ASSETS_TABLE = :geimser_remote_assets
  OBJECT_TYPE_ID = '9001'

  class RemoteAsset < ActiveRecord::Base
    self.table_name = 'geimser_remote_assets'
  end

  class << self
    def sync
      ensure_table

      now = Time.now.utc
      devices.each do |device|
        record = RemoteAsset.find_or_initialize_by(mesh_node_id: device[:mesh_node_id])
        record.created_at = now if record.new_record?
        record.assign_attributes(
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
        )
        record.save!
      end

      RemoteAsset.order(Arel.sql("CASE WHEN status = 'online' THEN 0 ELSE 1 END"), :group_name, :name).to_a
    end

    def idoit_object_types
      {
        'result' => [
          {
            'id' => OBJECT_TYPE_ID,
            'title' => 'Equipos MeshCentral',
            'const' => 'GEIMSER_MESH_DEVICE',
            'type_group_title' => 'CMDB Geimser',
            'status' => '2',
          },
        ],
      }
    end

    def idoit_objects(filter = {})
      records = sync
      records = filter_records(records, filter.to_h)

      {
        'result' => records.map { |record| idoit_object(record) },
      }
    end

    def idoit_object(record)
      title = record.name.presence || record.hostname.presence || record.mesh_node_id
      status_title = record.status == 'online' ? 'online' : 'offline'
      {
        'id' => record.id,
        'title' => title,
        'sysid' => record.mesh_node_id,
        'type' => OBJECT_TYPE_ID,
        'type_title' => 'Equipo MeshCentral',
        'type_group_title' => record.group_name.presence || 'Sin grupo',
        'status' => '2',
        'cmdb_status' => record.status == 'online' ? '6' : '5',
        'cmdb_status_title' => status_title,
        'link' => absolute_session_url(record.session_url),
        'hostname' => record.hostname,
        'os' => record.os_name,
        'ip' => record.ip_address,
        'last_seen_at' => record.last_seen_at&.iso8601,
      }
    end

    def mesh_backend_config?(api_token = nil, endpoint = nil)
      config = Setting.get('idoit_config').to_h.with_indifferent_access
      endpoint = endpoint.presence || config[:endpoint]
      token = api_token.presence || config[:api_token]
      endpoint.to_s == 'geimser://meshcentral' && token.present?
    rescue StandardError
      false
    end

    def filter_records(records, filter)
      ids = Array(filter[:ids] || filter['ids']).compact_blank.map(&:to_i)
      records = records.select { |record| ids.include?(record.id) } if ids.present?

      type = filter[:type] || filter['type']
      records = [] if type.present? && type.to_s != OBJECT_TYPE_ID

      query = (filter[:query] || filter['query']).to_s.downcase.strip
      if query.present?
        records = records.select do |record|
          [
            record.name,
            record.hostname,
            record.group_name,
            record.os_name,
            record.ip_address,
            record.mesh_node_id,
          ].compact.join(' ').downcase.include?(query)
        end
      end

      records
    end

    def ensure_table
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

    def devices
      return [] unless File.exist?(MESH_DB_PATH)

      rows = File.readlines(MESH_DB_PATH, chomp: true).filter_map do |line|
        JSON.parse(line)
      rescue JSON::ParserError
        nil
      end

      groups = rows
        .select { |row| row['type'] == 'mesh' }
        .each_with_object({}) { |row, memo| memo[row['_id']] = row['name'].presence || row['_id'] }
      sysinfo = sysinfo_by_node(rows)

      merged_nodes(rows).map { |row| device_from_row(row, groups, sysinfo[row['_id']]) }
    end

    def merged_nodes(rows)
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

    def device_from_row(row, groups, sysinfo)
      node_id = row['_id'].to_s
      mesh_group_id = row['meshid'].to_s.presence
      system = sysinfo.to_h['system'].to_h
      last_seen = last_seen(row, sysinfo)
      name = row['name'].presence || row['rname'].presence || row['host'].presence || node_id.split('/').last

      {
        mesh_node_id: node_id,
        mesh_group_id: mesh_group_id,
        group_name: groups[mesh_group_id] || 'Sin grupo',
        name: name,
        hostname: row['host'].presence || row['rname'].presence || row['name'].presence || system['Name'].presence,
        os_name: os_name(row, sysinfo),
        ip_address: ip_address(row, sysinfo),
        status: online?(row, last_seen) ? 'online' : 'offline',
        last_seen_at: last_seen,
        raw: row.merge('sysinfo' => sysinfo),
      }
    end

    def sysinfo_by_node(rows)
      rows
        .select { |row| row['type'] == 'sysinfo' && row['_id'].to_s.start_with?('sinode//') }
        .each_with_object({}) do |row, memo|
          memo[row['_id'].sub('sinode//', 'node//')] = row
        end
    end

    def online?(row, last_seen)
      return true if row['_geimser_seen_online']
      return true if row['conn'].to_i.positive?

      last_seen.present? && last_seen >= 15.minutes.ago
    end

    def last_seen(row, sysinfo)
      [
        row['lastconnect'],
        row['lastping'],
        row['firstconnect'],
        *Array(row['_geimser_seen_times']),
        sysinfo.to_h['time'],
      ].filter_map { |value| time(value) }.max
    end

    def os_name(row, sysinfo)
      osinfo = sysinfo.to_h['osinfo'].to_h
      [
        row['osdesc'].presence,
        [osinfo['Caption'].presence, osinfo['Version'].presence, osinfo['BuildNumber'].presence].compact_blank.join(' - ').presence,
        row.dig('agent', 'osdesc').presence,
        row.dig('agent', 'caps').to_s.presence,
      ].compact_blank.first
    end

    def ip_address(row, sysinfo)
      network = sysinfo.to_h['network'].to_h
      Array(row['iploc']).first.presence ||
        Array(network['netif']).filter_map { |iface| iface['ip'].presence }.first ||
        row['lastaddr'].to_s.split(':').first.presence
    end

    def time(value)
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

    def absolute_session_url(path)
      path = mesh_login_path_for(nil) if path.blank?
      "#{Setting.get('http_type')}://#{Setting.get('fqdn')}#{path}"
    end
  end
end

module GeimserMeshIdoitBridge
  def verify(api_token, endpoint, client_id = nil, verify_ssl: false)
    return GeimserMeshCmdb.idoit_object_types if GeimserMeshCmdb.mesh_backend_config?(api_token, endpoint)

    super
  end

  def query(method, filter = {})
    if GeimserMeshCmdb.mesh_backend_config?
      return GeimserMeshCmdb.idoit_object_types if method == 'cmdb.object_types'
      return GeimserMeshCmdb.idoit_objects(filter) if method == 'cmdb.objects'
    end

    super
  end
end

Rails.application.config.to_prepare do
  require_dependency 'idoit'

  class << Idoit
    prepend GeimserMeshIdoitBridge unless ancestors.include?(GeimserMeshIdoitBridge)
  end
end
