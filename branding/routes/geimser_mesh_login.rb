Rails.application.routes.draw do
  get '/geimser/mesh/login', to: 'geimser_mesh_login#show'
  get '/geimser/remote/assets', to: 'geimser_mesh_login#assets'
  get '/geimser/cmdb/search', to: 'geimser_mesh_login#search'
end
