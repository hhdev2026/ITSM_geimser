Rails.application.routes.append do
  get '/geimser/mesh/login', to: 'geimser_mesh_login#show'
end
