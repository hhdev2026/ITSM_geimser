UserInfo.current_user_id = 1 if defined?(UserInfo)

settings = {
  'product_name' => 'Geimser ITSM',
  'organization' => 'Geimser',
  'locale_default' => 'es-cl',
  'timezone_default' => 'America/Santiago',
  'http_type' => ENV.fetch('ZAMMAD_HTTP_TYPE', 'http'),
  'fqdn' => ENV.fetch('ZAMMAD_FQDN', 'localhost:8080'),
  'pretty_date_format' => 'absolute',
  'two_factor_authentication_enforce_role_ids' => [],
}

settings.each do |key, value|
  Setting.set(key, value)
end

logo_path = Rails.root.join('public/assets/images/geimser-logo.png')
if logo_path.exist? && defined?(Service::SystemAssets::ProductLogo)
  logo_timestamp = Service::SystemAssets::ProductLogo.store_logo(
    content: logo_path.binread,
    mime_type: 'image/png',
  )
  Setting.set('product_logo', logo_timestamp) if logo_timestamp
end

if Setting.exists?(name: 'idoit_integration')
  Setting.set('idoit_integration', true)
end

if Setting.exists?(name: 'idoit_config')
  Setting.set(
    'idoit_config',
    {
      endpoint: 'geimser://meshcentral',
      api_token: 'meshcentral',
      client_id: 'geimser',
      verify_ssl: true,
    }
  )
end

if Setting.exists?(name: 'maintenance_login')
  Setting.set('maintenance_login', true)
  Setting.set(
    'maintenance_login_message',
    '<strong>Bienvenido a Geimser ITSM.</strong><br>Centraliza tus solicitudes de soporte, consultoria e infraestructura para que nuestro equipo pueda darte seguimiento con claridad.'
  )
end

attribute = ObjectManager::Attribute.get(object: 'Ticket', name: 'tipo_servicio')

if attribute.nil?
  ObjectManager::Attribute.add(
    force: true,
    object: 'Ticket',
    name: 'tipo_servicio',
    display: 'Tipo de Servicio',
    data_type: 'select',
    data_option: {
      null: true,
      nulloption: true,
      multiple: false,
      default: '',
      translate: false,
      options: {
        'soporte_tecnico' => 'Soporte Tecnico',
        'consultoria' => 'Consultoria',
        'infraestructura' => 'Infraestructura',
        'otros' => 'Otros',
      },
      item_class: 'column',
    },
    editable: true,
    active: true,
    screens: {
      create_middle: {
        'ticket.agent' => { null: true, item_class: 'column' },
        'ticket.customer' => { null: true, item_class: 'column' },
      },
      edit: {
        'ticket.agent' => { null: true },
        'ticket.customer' => { null: true },
      },
      view: {
        '-all-' => { shown: true },
      },
    },
    position: 1550,
  )
  ObjectManager::Attribute.migration_execute
end

remote_attributes = [
  {
    name: 'geimser_cmdb_device',
    display: 'Equipo CMDB',
    position: 1560,
    data_type: 'autocompletion_ajax_external_data_source',
    data_option: {
      search_url: "#{ENV.fetch('ZAMMAD_HTTP_TYPE', 'http')}://#{ENV.fetch('ZAMMAD_FQDN', 'localhost:8080')}/geimser/cmdb/search?token=#{ENV.fetch('GEIMSER_CMDB_TOKEN')}&query=#{'#{search.term}'}",
      search_result_list_key: '',
      search_result_value_key: 'value',
      search_result_label_key: 'label',
      verify_ssl: false,
      null: true,
      default: '',
      relation: '',
      item_class: 'column',
    },
  },
  {
    name: 'meshcentral_session_url',
    display: 'Enlace Sesion Remota',
    position: 1570,
    data_type: 'input',
    data_option: {
      type: 'text',
      maxlength: 255,
      null: true,
      item_class: 'column',
    },
  },
]

legacy_meshcentral_device_attribute = ObjectManager::Attribute.get(object: 'Ticket', name: 'meshcentral_device_id')
if legacy_meshcentral_device_attribute&.active
  legacy_meshcentral_device_attribute.update!(active: false)
end

remote_attributes.each do |remote_attribute|
  existing_remote_attribute = ObjectManager::Attribute.get(object: 'Ticket', name: remote_attribute[:name])
  attribute_payload = {
    object: 'Ticket',
    name: remote_attribute[:name],
    display: remote_attribute[:display],
    data_type: remote_attribute[:data_type],
    data_option: remote_attribute[:data_option],
    editable: true,
    active: true,
    screens: {
      create_middle: {
        'ticket.agent' => { null: true, item_class: 'column' },
      },
      edit: {
        'ticket.agent' => { null: true },
      },
      view: {
        'ticket.agent' => { shown: true },
      },
    },
    position: remote_attribute[:position],
  }

  if existing_remote_attribute && existing_remote_attribute.data_type == remote_attribute[:data_type]
    existing_remote_attribute.update!(attribute_payload.except(:object))
  elsif existing_remote_attribute
    existing_remote_attribute.update!(active: false)
    ObjectManager::Attribute.add(force: true, **attribute_payload.merge(name: "#{remote_attribute[:name]}_native"))
  else
    ObjectManager::Attribute.add(force: true, **attribute_payload)
  end
end

ObjectManager::Attribute.migration_execute

organization = Organization.create_if_not_exists(name: 'Geimser', active: true)
admin_attributes = {
  login: 'admin@geimser.local',
  firstname: 'Admin',
  lastname: 'Geimser',
  email: 'admin@geimser.local',
  active: true,
  organization_id: organization.id,
  roles: [Role.find_by(name: 'Admin'), Role.find_by(name: 'Agent')].compact,
  created_by_id: 1,
  updated_by_id: 1,
}

admin_password = ENV['GEIMSER_ADMIN_PASSWORD'].to_s.presence
if User.find_by(login: admin_attributes[:login]).nil?
  raise 'GEIMSER_ADMIN_PASSWORD is required for the initial admin user.' if admin_password.blank?

  admin_attributes[:password] = admin_password
end

admin = User.create_or_update(**admin_attributes)

demo_organization = Organization.create_if_not_exists(name: 'Geimser Demo', active: true)
demo_group = Group.create_if_not_exists(name: 'Demo Comercial', active: true)
demo_user = User.create_or_update(
  login: ENV.fetch('GEIMSER_DEMO_USER', 'demo@geimser.local'),
  firstname: 'Demo',
  lastname: 'Geimser',
  email: ENV.fetch('GEIMSER_DEMO_USER', 'demo@geimser.local'),
  active: true,
  organization_id: demo_organization.id,
  roles: [Role.find_by(name: 'Agent')].compact,
  created_by_id: 1,
  updated_by_id: 1,
)

demo_user_group = UserGroup.find_or_initialize_by(user_id: demo_user.id, group_id: demo_group.id)
demo_user_group.access = 'full'
demo_user_group.save!

group = Group.find_by(name: 'Users') || Group.first
if group
  user_group = UserGroup.find_or_initialize_by(user_id: admin.id, group_id: group.id)
  user_group.access = 'full'
  user_group.save!
end

support_signature = Signature.find_or_initialize_by(name: 'Soporte Geimser')
support_signature.assign_attributes(
  body: '<p>#{user.firstname} #{user.lastname}<br>Soporte Geimser</p>',
  active: true,
  updated_by_id: 1,
)
support_signature.created_by_id ||= 1
support_signature.save!

Group.where(active: true).find_each do |active_group|
  next if active_group.signature_id == support_signature.id

  active_group.update!(signature_id: support_signature.id, updated_by_id: 1)
end

Setting.set('system_init_done', true)
Rails.cache.clear if defined?(Rails)

puts 'Configuracion Geimser aplicada.'
