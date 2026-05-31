UserInfo.current_user_id = 1 if defined?(UserInfo)

settings = {
  'product_name' => 'ITSM Geimser',
  'organization' => 'Geimser',
  'locale_default' => 'es-cl',
  'timezone_default' => 'America/Santiago',
  'http_type' => ENV.fetch('ZAMMAD_HTTP_TYPE', 'http'),
  'fqdn' => ENV.fetch('ZAMMAD_FQDN', 'localhost:8080'),
  'product_logo' => 'geimser-logo-v2.png',
  'pretty_date_format' => 'absolute',
  'two_factor_authentication_enforce_role_ids' => [],
}

settings.each do |key, value|
  Setting.set(key, value)
end

if Setting.exists?(name: 'maintenance_login')
  Setting.set('maintenance_login', true)
  Setting.set(
    'maintenance_login_message',
    '<strong>Bienvenido a ITSM Geimser.</strong><br>Centraliza tus solicitudes de soporte, consultoria e infraestructura para que nuestro equipo pueda darte seguimiento con claridad.'
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
    name: 'meshcentral_device_id',
    display: 'ID Equipo MeshCentral',
    position: 1560,
  },
  {
    name: 'meshcentral_session_url',
    display: 'Enlace Sesion Remota',
    position: 1570,
  },
]

remote_attributes.each do |remote_attribute|
  next if ObjectManager::Attribute.get(object: 'Ticket', name: remote_attribute[:name])

  ObjectManager::Attribute.add(
    force: true,
    object: 'Ticket',
    name: remote_attribute[:name],
    display: remote_attribute[:display],
    data_type: 'input',
    data_option: {
      type: 'text',
      maxlength: 255,
      null: true,
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
    position: remote_attribute[:position],
  )
end

ObjectManager::Attribute.migration_execute

admin_password = ENV.fetch('GEIMSER_ADMIN_PASSWORD', 'GeimserM1!2026')
organization = Organization.create_if_not_exists(name: 'Geimser', active: true)
admin = User.create_or_update(
  login: 'admin@geimser.local',
  firstname: 'Admin',
  lastname: 'Geimser',
  email: 'admin@geimser.local',
  password: admin_password,
  active: true,
  organization_id: organization.id,
  roles: [Role.find_by(name: 'Admin'), Role.find_by(name: 'Agent')].compact,
  created_by_id: 1,
  updated_by_id: 1,
)

group = Group.find_by(name: 'Users') || Group.first
if group
  user_group = UserGroup.find_or_initialize_by(user_id: admin.id, group_id: group.id)
  user_group.access = 'full'
  user_group.save!
end

Setting.set('system_init_done', true)
Rails.cache.clear if defined?(Rails)

puts 'Configuracion Geimser aplicada.'
