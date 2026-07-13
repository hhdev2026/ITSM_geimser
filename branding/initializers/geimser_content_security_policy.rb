Rails.application.config.content_security_policy do |policy|
  require 'uri'

  zammad_fqdn = ENV.fetch('ZAMMAD_FQDN', 'localhost:8080')
  mesh_public_url = ENV['MESH_PUBLIC_URL'].presence || "https://#{ENV.fetch('MESH_HOSTNAME', zammad_fqdn.split(':').first)}"
  mesh_public_url = "https://#{mesh_public_url}" if mesh_public_url !~ %r{\Ahttps?://}i
  mesh_origin = begin
    uri = URI.parse(mesh_public_url)
    "#{uri.scheme}://#{uri.host}#{uri.port && ![80, 443].include?(uri.port) ? ":#{uri.port}" : ''}"
  rescue URI::InvalidURIError
    'https://remoto.geimser.cl'
  end

  policy.frame_src(
    :self,
    'www.youtube.com',
    'player.vimeo.com',
    "http://#{zammad_fqdn}",
    mesh_origin,
  )
  policy.frame_ancestors(
    :self,
    'https://www.geimser.cl',
    'https://geimser.cl',
  )
end
