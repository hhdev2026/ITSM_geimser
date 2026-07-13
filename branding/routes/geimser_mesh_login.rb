Rails.application.routes.draw do
  get '/geimser/mesh/login', to: 'geimser_mesh_login#show'
  get '/geimser/bot/login', to: 'geimser_mesh_login#bot_login'
  get '/geimser/bot/session', to: 'geimser_mesh_login#bot_session'
  get '/geimser/demo', to: 'geimser_mesh_login#demo'
  post '/geimser/demo/session', to: 'geimser_mesh_login#demo_session'
  get '/geimser/remote/assets', to: 'geimser_mesh_login#assets'
  get '/geimser/cmdb/search', to: 'geimser_mesh_login#search'
end
