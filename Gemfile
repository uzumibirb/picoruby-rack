source "https://rubygems.org"

local_gem = ENV["PICORUBY_CLOUDFLARE_TEMPLATE_GEM_PATH"]
if local_gem && !local_gem.empty?
  gem "picoruby-cloudflare-template", path: File.expand_path(local_gem, __dir__)
else
  gem "picoruby-cloudflare-template",
      git: "https://github.com/udzura/picoruby-cloudflare-template.git",
      ref: "d3fd1f88125c9bcc0d722a07627ebbc5a5e74845"
end
