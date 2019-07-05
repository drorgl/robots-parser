import {expect} from "chai";
import "mocha";
import {Robots as robotsParser} from "../src/Robots";

function testRobots(url: string, contents: string, allowed: string[], disallowed: string[]) {
	const robots = new robotsParser(url, contents);

	allowed.forEach((url_) => {
		expect(robots.isAllowed(url_)).to.equal(true);
	});

	disallowed.forEach((url_) => {
		expect(robots.isDisallowed(url_)).to.equal(true);
	});
}

describe("Robots", () => {
	it("should parse the disallow directive", () => {
		const contents = [
			"User-agent: *",
			"Disallow: /fish/",
			"Disallow: /test.html"
		].join("\n");

		const allowed = [
			"http://www.example.com/fish",
			"http://www.example.com/Test.html"
		];

		const disallowed = [
			"http://www.example.com/fish/index.php",
			"http://www.example.com/fish/",
			"http://www.example.com/test.html"
		];

		testRobots("http://www.example.com/robots.txt", contents, allowed, disallowed);
	});

	it("should parse the allow directive", () => {
		const contents = [
			"User-agent: *",
			"Disallow: /fish/",
			"Disallow: /test.html",
			"Allow: /fish/test.html",
			"Allow: /test.html"
		].join("\n");

		const allowed = [
			"http://www.example.com/fish",
			"http://www.example.com/fish/test.html",
			"http://www.example.com/Test.html"
		];

		const disallowed = [
			"http://www.example.com/fish/index.php",
			"http://www.example.com/fish/",
			"http://www.example.com/test.html"
		];

		testRobots("http://www.example.com/robots.txt", contents, allowed, disallowed);
	});

	it("should parse patterns", () => {
		const contents = [
			"User-agent: *",
			"Disallow: /fish*.php",
			"Disallow: /*.dext$"
		].join("\n");

		const allowed = [
			"http://www.example.com/Fish.PHP",
			"http://www.example.com/Fish.dext1"
		];

		const disallowed = [
			"http://www.example.com/fish.php",
			"http://www.example.com/fishheads/catfish.php?parameters",
			"http://www.example.com/AnYthInG.dext",
			"http://www.example.com/Fish.dext.dext"
		];

		testRobots("http://www.example.com/robots.txt", contents, allowed, disallowed);
	});

	it("should have the correct order precedence for allow and disallow", () => {
		const contents = [
			"User-agent: *",
			"Disallow: /fish*.php",
			"Allow: /fish/index.php",
			"Disallow: /test",
			"Allow: /test/",
		].join("\n");

		const allowed = [
			"http://www.example.com/test/index.html",
			"http://www.example.com/test/"
		];

		const disallowed = [
			"http://www.example.com/fish.php",
			"http://www.example.com/fishheads/catfish.php?parameters",
			"http://www.example.com/fish/index.php",
			"http://www.example.com/test"
		];

		testRobots("http://www.example.com/robots.txt", contents, allowed, disallowed);
	});

	it("should ignore rules that are not in a group", () => {
		const contents = [
			"Disallow: /secret.html",
			"Disallow: /test",
		].join("\n");

		const allowed = [
			"http://www.example.com/secret.html",
			"http://www.example.com/test/index.html",
			"http://www.example.com/test/"
		];

		testRobots("http://www.example.com/robots.txt", contents, allowed, []);
	});

	it("should ignore comments", () => {
		const contents = [
			"#",
			"# This is a comment",
			"#",
			"User-agent: *",
			"# This is a comment",
			"Disallow: /fish/ # ignore",
			"# Disallow: fish",
			"Disallow: /test.html"
		].join("\n");

		const allowed = [
			"http://www.example.com/fish",
			"http://www.example.com/Test.html"
		];

		const disallowed = [
			"http://www.example.com/fish/index.php",
			"http://www.example.com/fish/",
			"http://www.example.com/test.html"
		];

		testRobots("http://www.example.com/robots.txt", contents, allowed, disallowed);
	});

	it("should ignore invalid lines", () => {
		const contents = [
			"invalid line",
			"User-agent: *",
			"Disallow: /fish/",
			":::::another invalid line:::::",
			"Disallow: /test.html",
			"Unknown: tule"
		].join("\n");

		const allowed = [
			"http://www.example.com/fish",
			"http://www.example.com/Test.html"
		];

		const disallowed = [
			"http://www.example.com/fish/index.php",
			"http://www.example.com/fish/",
			"http://www.example.com/test.html"
		];

		testRobots("http://www.example.com/robots.txt", contents, allowed, disallowed);
	});

	it("should ignore empty user-agent lines", () => {
		const contents = [
			"User-agent:",
			"Disallow: /fish/",
			"Disallow: /test.html"
		].join("\n");

		const allowed = [
			"http://www.example.com/fish",
			"http://www.example.com/Test.html",
			"http://www.example.com/fish/index.php",
			"http://www.example.com/fish/",
			"http://www.example.com/test.html"
		];

		const disallowed: string[] = [];

		testRobots("http://www.example.com/robots.txt", contents, allowed, disallowed);
	});

	it("should support groups with multiple user agents (case insensitive)", () => {
		const contents = [
			"User-agent: agenta",
			"User-agent: agentb",
			"Disallow: /fish",
		].join("\n");

		const robots = new robotsParser("http://www.example.com/robots.txt", contents);

		expect(robots.isAllowed("http://www.example.com/fish", "agenta")).to.equal(false);
	});

	it("should return undefined for invalid urls", () => {
		const contents = [
			"User-agent: *",
			"Disallow: /secret.html",
			"Disallow: /test",
		].join("\n");

		const invalidUrls = [
			"http://example.com/secret.html",
			"http://www.example.net/test/index.html",
			"http://www.examsple.com/test/",
			"example.com/test/",
			":::::;;`\\|/.example.com/test/"
		];

		const robots = new robotsParser("http://www.example.com/robots.txt", contents);

		invalidUrls.forEach((url) => {
			expect(robots.isAllowed(url)).to.equal(undefined);
		});
	});

	it("should handle Unicode, urlencoded and punycode URLs", () => {
		const contents = [
			"User-agent: *",
			"Disallow: /secret.html",
			"Disallow: /test",
		].join("\n");

		const allowed = [
			"http://www.münich.com/index.html",
			"http://www.xn--mnich-kva.com/index.html",
			"http://www.m%C3%BCnich.com/index.html"
		];

		const disallowed = [
			"http://www.münich.com/secret.html",
			"http://www.xn--mnich-kva.com/secret.html",
			"http://www.m%C3%BCnich.com/secret.html"
		];

		testRobots("http://www.münich.com/robots.txt", contents, allowed, disallowed);
		testRobots("http://www.xn--mnich-kva.com/robots.txt", contents, allowed, disallowed);
		testRobots("http://www.m%C3%BCnich.com/robots.txt", contents, allowed, disallowed);
	});

	it("should handle Unicode and urlencoded paths", () => {
		const contents = [
			"User-agent: *",
			"Disallow: /%CF%80",
			"Disallow: /%e2%9d%83",
			"Disallow: /%a%a",
			"Disallow: /💩",
			"Disallow: /✼*t$",
			"Disallow: /%E2%9C%A4*t$",
			"Disallow: /✿%a",
			"Disallow: /http%3A%2F%2Fexample.org"
		].join("\n");

		const allowed = [
			"http://www.example.com/✼testing",
			"http://www.example.com/%E2%9C%BCtesting",
			"http://www.example.com/✤testing",
			"http://www.example.com/%E2%9C%A4testing",
			"http://www.example.com/http://example.org",
			"http://www.example.com/http:%2F%2Fexample.org"
		];

		const disallowed = [
			"http://www.example.com/%CF%80",
			"http://www.example.com/%CF%80/index.html",
			"http://www.example.com/π",
			"http://www.example.com/π/index.html",
			"http://www.example.com/%e2%9d%83",
			"http://www.example.com/%E2%9D%83/index.html",
			"http://www.example.com/❃",
			"http://www.example.com/❃/index.html",
			"http://www.example.com/%F0%9F%92%A9",
			"http://www.example.com/%F0%9F%92%A9/index.html",
			"http://www.example.com/💩",
			"http://www.example.com/💩/index.html",
			"http://www.example.com/%a%a",
			"http://www.example.com/%a%a/index.html",
			"http://www.example.com/✼test",
			"http://www.example.com/%E2%9C%BCtest",
			"http://www.example.com/✤test",
			"http://www.example.com/%E2%9C%A4testt",
			"http://www.example.com/✿%a",
			"http://www.example.com/%E2%9C%BF%atest",
			"http://www.example.com/http%3A%2F%2Fexample.org"
		];

		testRobots("http://www.example.com/robots.txt", contents, allowed, disallowed);
	});

	it("should handle lone high / low surrogates", () => {
		const contents = [
			"User-agent: *",
			"Disallow: /\uD800",
			"Disallow: /\uDC00"
		].join("\n");

		// These are invalid so can't be disallowed
		const allowed = [
			"http://www.example.com/\uDC00",
			"http://www.example.com/\uD800"
		];

		const disallowed: string[] = [];

		testRobots("http://www.example.com/robots.txt", contents, allowed, disallowed);
	});

	it("should ignore host case", () => {
		const contents = [
			"User-agent: *",
			"Disallow: /secret.html",
			"Disallow: /test",
		].join("\n");

		const allowed = [
			"http://www.example.com/index.html",
			"http://www.ExAmPlE.com/index.html",
			"http://www.EXAMPLE.com/index.html"
		];

		const disallowed = [
			"http://www.example.com/secret.html",
			"http://www.ExAmPlE.com/secret.html",
			"http://www.EXAMPLE.com/secret.html"
		];

		testRobots("http://www.eXample.com/robots.txt", contents, allowed, disallowed);
	});

	it("should allow all if empty robots.txt", () => {
		const allowed = [
			"http://www.example.com/secret.html",
			"http://www.example.com/test/index.html",
			"http://www.example.com/test/"
		];

		const robots = new robotsParser("http://www.example.com/robots.txt", "");

		allowed.forEach((url) => {
			expect(robots.isAllowed(url)).to.equal(true);
		});
	});

	it("should treat null as allowing all", () => {
		const robots = new robotsParser("http://www.example.com/robots.txt", null);

		expect(robots.isAllowed("http://www.example.com/", "userAgent")).to.equal(true);
		expect(robots.isAllowed("http://www.example.com/")).to.equal(true);
	});

	it("should handle invalid robots.txt urls", () => {
		const contents = [
			"user-agent: *",
			"disallow: /",

			"host: www.example.com",
			"sitemap: /sitemap.xml"
		].join("\n");

		const sitemapUrls = [
			undefined,
			null,
			"null",
			":/wom/test/"
		];

		sitemapUrls.forEach((url) => {
			const robots = new robotsParser(url, contents);
			expect(robots.isAllowed("http://www.example.com/index.html")).to.equal(undefined);
			expect(robots.getPreferredHost()).to.equal("www.example.com");
			expect(robots.getSitemaps()).to.eql(["/sitemap.xml"]);
		});
	});

	it("should parse the crawl-delay directive", () => {
		const contents = [
			"user-agent: a",
			"crawl-delay: 1",

			"user-agent: b",
			"disallow: /d",

			"user-agent: c",
			"user-agent: d",
			"crawl-delay: 10"
		].join("\n");

		const robots = new robotsParser("http://www.example.com/robots.txt", contents);

		expect(robots.getCrawlDelay("a")).to.equal(1);
		expect(robots.getCrawlDelay("b")).to.equal(undefined);
		expect(robots.getCrawlDelay("c")).to.equal(10);
		expect(robots.getCrawlDelay("d")).to.equal(10);
		expect(robots.getCrawlDelay()).to.equal(undefined);
	});

	it("should ignore invalid crawl-delay directives", () => {
		const contents = [
			"user-agent: a",
			"crawl-delay: 1.2.1",

			"user-agent: b",
			"crawl-delay: 1.a0",

			"user-agent: c",
			"user-agent: d",
			"crawl-delay: 10a"
		].join("\n");

		const robots = new robotsParser("http://www.example.com/robots.txt", contents);

		expect(robots.getCrawlDelay("a")).to.equal(undefined);
		expect(robots.getCrawlDelay("b")).to.equal(undefined);
		expect(robots.getCrawlDelay("c")).to.equal(undefined);
		expect(robots.getCrawlDelay("d")).to.equal(undefined);
	});

	it("should parse the sitemap directive", () => {
		const contents = [
			"user-agent: a",
			"crawl-delay: 1",
			"sitemap: http://example.com/test.xml",

			"user-agent: b",
			"disallow: /d",

			"sitemap: /sitemap.xml",
			"sitemap:     http://example.com/test/sitemap.xml     "
		].join("\n");

		const robots = new robotsParser("http://www.example.com/robots.txt", contents);

		expect(robots.getSitemaps()).to.eql([
			"http://example.com/test.xml",
			"/sitemap.xml",
			"http://example.com/test/sitemap.xml"
		]);
	});

	it("should parse the host directive", () => {
		const contents = [
			"user-agent: a",
			"crawl-delay: 1",
			"host: www.example.net",

			"user-agent: b",
			"disallow: /d",

			"host: example.com"
		].join("\n");

		const robots = new robotsParser("http://www.example.com/robots.txt", contents);

		expect(robots.getPreferredHost()).to.equal("example.com");
	});

	it("should parse empty and invalid directives", () => {
		const contents = [
			"user-agent:",
			"user-agent:::: a::",
			"crawl-delay:",
			"crawl-delay:::: 0:",
			"host:",
			"host:: example.com",
			"sitemap:",
			"sitemap:: site:map.xml",
			"disallow:",
			"disallow::: /:",
			"allow:",
			"allow::: /:",
		].join("\n");

		const parser = new robotsParser("http://www.example.com/robots.txt", contents);
	});

	it("should treat only the last host directive as valid", () => {
		const contents = [
			"user-agent: a",
			"crawl-delay: 1",
			"host: www.example.net",

			"user-agent: b",
			"disallow: /d",

			"host: example.net",
			"host: example.com"
		].join("\n");

		const robots = new robotsParser("http://www.example.com/robots.txt", contents);

		expect(robots.getPreferredHost()).to.equal("example.com");
	});

	it("should return null when there is no host directive", () => {
		const contents = [
			"user-agent: a",
			"crawl-delay: 1",

			"user-agent: b",
			"disallow: /d",
		].join("\n");

		const robots = new robotsParser("http://www.example.com/robots.txt", contents);

		expect(robots.getPreferredHost()).to.equal(null);
	});

	it("should fallback to * when a UA has no rules of its own", () => {
		const contents = [
			"user-agent: *",
			"crawl-delay: 1",

			"user-agent: b",
			"crawl-delay: 12",

			"user-agent: c",
			"user-agent: d",
			"crawl-delay: 10"
		].join("\n");

		const robots = new robotsParser("http://www.example.com/robots.txt", contents);

		expect(robots.getCrawlDelay("should-fall-back")).to.equal(1);
		expect(robots.getCrawlDelay("d")).to.equal(10);
		expect(robots.getCrawlDelay("dd")).to.equal(1);
	});

	it("should not fallback to * when a UA has rules", () => {
		const contents = [
			"user-agent: *",
			"crawl-delay: 1",

			"user-agent: b",
			"disallow:"
		].join("\n");

		const robots = new robotsParser("http://www.example.com/robots.txt", contents);

		expect(robots.getCrawlDelay("b")).to.equal(undefined);
	});

	it("should ignore version numbers in the UA string", () => {
		const contents = [
			"user-agent: *",
			"crawl-delay: 1",

			"user-agent: b",
			"crawl-delay: 12",

			"user-agent: c",
			"user-agent: d",
			"crawl-delay: 10"
		].join("\n");

		const robots = new robotsParser("http://www.example.com/robots.txt", contents);

		expect(robots.getCrawlDelay("should-fall-back/1.0.0")).to.equal(1);
		expect(robots.getCrawlDelay("d/12")).to.equal(10);
		expect(robots.getCrawlDelay("dd / 0-32-3")).to.equal(1);
		expect(robots.getCrawlDelay("b / 1.0")).to.equal(12);
	});

	it("should return the line number of the matching directive", () => {
		const contents = [
			"",
			"User-agent: *",
			"",
			"Disallow: /fish/",
			"Disallow: /test.html",
			"Allow: /fish/test.html",
			"Allow: /test.html",
			"",
			"User-agent: a",
			"allow: /",
			"",
			"User-agent: b",
			"disallow: /test",
			"disallow: /t*t",
			// check UA returns -1 if no matching UA and also handles patterns both allow and disallow
		].join("\n");

		const robots = new robotsParser("http://www.example.com/robots.txt", contents);

		expect(robots.getMatchingLineNumber("http://www.example.com/fish")).to.equal(-1);
		expect(robots.getMatchingLineNumber("http://www.example.com/fish/test.html")).to.equal(6);
		expect(robots.getMatchingLineNumber("http://www.example.com/Test.html")).to.equal(-1);

		expect(robots.getMatchingLineNumber("http://www.example.com/fish/index.php")).to.equal(4);
		expect(robots.getMatchingLineNumber("http://www.example.com/fish/")).to.equal(4);
		expect(robots.getMatchingLineNumber("http://www.example.com/test.html")).to.equal(5);

		expect(robots.getMatchingLineNumber("http://www.example.com/test.html", "a")).to.equal(10);
		expect(robots.getMatchingLineNumber("http://www.example.com/test.html", "b")).to.equal(14);
	});
});
