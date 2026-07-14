#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

docker-compose run --rm zammad-railsserver bundle exec rails runner - <<'RUBY'
login = ENV.fetch('GEIMSER_DEMO_USER', 'demo@geimser.local')
user = User.find_by(login: login)
abort "Demo user #{login} is missing" if user.blank?
abort "Demo user #{login} is inactive" unless user.active
abort "Demo user #{login} has no Agent role" unless user.roles.any? { |role| role.name == 'Agent' }

group = Group.find_by(name: 'Demo Comercial')
abort 'Demo Comercial group is missing' if group.blank?

membership = UserGroup.find_by(user_id: user.id, group_id: group.id)
abort "Demo user #{login} has no Demo Comercial membership" if membership.blank?
abort "Demo user #{login} does not have full demo access" unless membership.access == 'full'

puts "Demo account verified: #{login}"
RUBY
