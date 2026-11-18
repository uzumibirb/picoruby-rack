require "picoruby/cloudflare/template/project"
require_relative "scripts/picoruby-checkout"

Picoruby::Cloudflare::Template::Project.new(root: __dir__).define_tasks

task :prepare_picoruby do
  PicoRubyCheckout.prepare(__dir__)
end

%i[build dev check deploy doctor].each do |name|
  Rake::Task[name].enhance([:prepare_picoruby])
end
