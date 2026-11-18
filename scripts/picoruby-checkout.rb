# frozen_string_literal: true

require "fileutils"
require "json"
require "net/http"
require "tmpdir"

module PicoRubyCheckout
  REPOSITORY = "https://github.com/picoruby/picoruby.git"
  LATEST_RELEASE = URI("https://api.github.com/repos/picoruby/picoruby/releases/latest")

  def self.prepare(root)
    return unless ENV["PICORUBY_ROOT"].to_s.empty?

    checkout = File.join(root, "picoruby")
    install(checkout, File.join(root, ".picoruby-build")) unless existing_checkout?(checkout)
    ENV["PICORUBY_ROOT"] = checkout
  end

  def self.existing_checkout?(checkout)
    return false unless File.exist?(checkout) || File.symlink?(checkout)
    return true if File.file?(File.join(checkout, "Rakefile"))

    raise "#{checkout} exists but is not a PicoRuby checkout. Set PICORUBY_ROOT to a usable checkout."
  end
  private_class_method :existing_checkout?

  def self.install(checkout, build_dir)
    FileUtils.mkdir_p(build_dir)
    File.open(File.join(build_dir, "picoruby-checkout.lock"), "a") do |lock|
      lock.flock(File::LOCK_EX)
      return if existing_checkout?(checkout)

      tag = latest_release_tag
      puts "Checking out PicoRuby #{tag} into #{checkout}"
      Dir.mktmpdir("picoruby-checkout-", build_dir) do |staging|
        source = File.join(staging, "picoruby")
        cloned = system("git", "-c", "advice.detachedHead=false", "clone",
                        "--branch", tag, "--depth", "1", "--recurse-submodules",
                        "--shallow-submodules", "--", REPOSITORY, source)
        raise "Could not check out PicoRuby #{tag}. Check the Git output or set PICORUBY_ROOT." unless cloned

        File.rename(source, checkout) unless existing_checkout?(checkout)
      end
    end
  end
  private_class_method :install

  def self.latest_release_tag
    response = Net::HTTP.start(LATEST_RELEASE.host, LATEST_RELEASE.port,
                               use_ssl: true, open_timeout: 10, read_timeout: 20) do |http|
      http.get(LATEST_RELEASE.request_uri, "Accept" => "application/vnd.github+json")
    end
    unless response.is_a?(Net::HTTPSuccess)
      raise "Could not look up the latest PicoRuby release (GitHub HTTP #{response.code}). Set PICORUBY_ROOT to use a local checkout."
    end

    tag = JSON.parse(response.body)["tag_name"]
    raise "The latest PicoRuby release has no tag" unless tag.is_a?(String) && !tag.empty?
    tag
  end
  private_class_method :latest_release_tag
end
