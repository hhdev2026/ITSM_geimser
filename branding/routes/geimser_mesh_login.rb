Rails.application.routes.draw do
  get '/geimser/mesh/login', to: 'geimser_mesh_login#show'
  get '/geimser/bot/login', to: 'geimser_mesh_login#bot_login'
  get '/geimser/bot/session', to: 'geimser_mesh_login#bot_session'
  get '/geimser/demo', to: 'geimser_mesh_login#demo'
  post '/geimser/demo/session', to: 'geimser_mesh_login#demo_session'
  get '/geimser/remote/assets', to: 'geimser_mesh_login#assets'
  get '/geimser/cmdb/search', to: 'geimser_mesh_login#search'

  get '/api/inventory-map', to: 'geimser_mesh_login#inventory_map'
  get '/api/inventory-map/csrf', to: 'geimser_mesh_login#inventory_csrf'
  get '/api/inventory-map/options', to: 'geimser_mesh_login#inventory_options'
  get '/api/inventory-map/recommend-asset/:user_id', to: 'geimser_mesh_login#recommend_asset'
  get '/api/inventory-map/recommend-user/:asset_id', to: 'geimser_mesh_login#recommend_user'
  post '/api/inventory-map/assign', to: 'geimser_mesh_login#assign_inventory_map'

  get '/api/secure-secrets', to: 'geimser_secure_secrets#index'
  post '/api/secure-secrets', to: 'geimser_secure_secrets#create'
  delete '/api/secure-secrets/:id', to: 'geimser_secure_secrets#destroy'
  get '/secure-secrets/s/:token', to: 'geimser_secure_secrets#public_show'
  get '/api/secure-secrets/public/:token', to: 'geimser_secure_secrets#public_metadata'
  post '/api/secure-secrets/public/:token/reveal', to: 'geimser_secure_secrets#reveal'
end
