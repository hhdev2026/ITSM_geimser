Rails.application.config.content_security_policy do |policy|
  zammad_fqdn = ENV.fetch('ZAMMAD_FQDN', 'localhost:8080')
  mesh_hostname = ENV.fetch('MESH_HOSTNAME', zammad_fqdn.split(':').first)

  policy.frame_src(
    :self,
    'www.youtube.com',
    'player.vimeo.com',
    "http://#{zammad_fqdn}",
    "https://#{mesh_hostname}",
    "https://#{mesh_hostname}:443",
  )
end
