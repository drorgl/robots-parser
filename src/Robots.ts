import url from "url";

// var URL = require('url').URL;

interface IRule {
	pattern: string | RegExp;
	allow: boolean;
	lineNumber: number;
	crawlDelay?: number;
}

/**
 * Trims the white space from the start and end of the line.
 *
 * If the line is an array it will strip the white space from
 * the start and end of each element of the array.
 *
 * @param  {string|Array} line
 * @return {string|Array}
 * @private
 */
function trimLine(line: string | string[]): string | string[] {
	if (!line) {
		return null;
	}

	if (Array.isArray(line)) {
		return line.map(trimLine) as string[];
	}

	return String(line).trim();
}

/**
 * Remove comments from lines
 *
 * @param {string} line
 * @return {string}
 * @private
 */
function removeComments(line: string): string {
	const commentStartIndex = line.indexOf("#");
	if (commentStartIndex > -1) {
		return line.substr(0, commentStartIndex);
	}

	return line;
}

/**
 * Splits a line at the first occurrence of :
 *
 * @param  {string} line
 * @return {Array.<string>}
 * @private
 */
function splitLine(line: string): string[] {
	const idx = String(line).indexOf(":");

	if (!line || idx < 0) {
		return null;
	}

	return [line.slice(0, idx), line.slice(idx + 1)];
}

/**
 * Normalizes the user-agent string by converting it to
 * lower case and removing any version numbers.
 *
 * @param  {string} userAgent
 * @return {string}
 * @private
 */
function formatUserAgent(userAgent: string): string {
	let formattedUserAgent = userAgent.toLowerCase();

	// Strip the version number from robot/1.0 user agents
	const idx = formattedUserAgent.indexOf("/");
	if (idx > -1) {
		formattedUserAgent = formattedUserAgent.substr(0, idx);
	}

	return formattedUserAgent.trim();
}

/**
 * Normalizes the URL encoding of a path by encoding
 * unicode characters.
 *
 * @param {string} path
 * @return {string}
 * @private
 */
function normalizeEncoding(path: string): string {
	try {
		return urlEncodeToUpper(encodeURI(path).replace(/%25/g, "%"));
	} catch (e) {
		return path;
	}
}

/**
 * Convert URL encodings to support case.
 *
 * e.g.: %2a%ef becomes %2A%EF
 *
 * @param {string} path
 * @return {string}
 * @private
 */
function urlEncodeToUpper(path: string): string {
	return path.replace(/%[0-9a-fA-F]{2}/g, (match) => {
		return match.toUpperCase();
	});
}

/**
 * Converts the pattern into a regexp if it is a wildcard
 * pattern.
 *
 * Returns a string if the pattern isn't a wildcard pattern
 *
 * @param  {string} pattern
 * @return {string|RegExp}
 * @private
 */
function parsePattern(pattern: string): string | RegExp {
	const regexSpecialChars = /[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/g;
	// Treat consecutive wildcards as one (#12)
	const wildCardPattern = /\*+/g;
	const endOfLinePattern = /\\\$$/;

	pattern = normalizeEncoding(pattern);

	if (pattern.indexOf("*") < 0 && pattern.indexOf("$") < 0) {
		return pattern;
	}

	const isStartOfPath = pattern.charAt(0) === "/";

	pattern = pattern
		.replace(regexSpecialChars, "\\$&")
		.replace(wildCardPattern, "(?:.*)")
		.replace(endOfLinePattern, "$");

	if (isStartOfPath) {
		pattern = "^" + pattern;
	}

	return new RegExp(pattern);
}

function parseRobots(contents: string, robots: Robots) {
	const newlineRegex = /\r\n|\r|\n/;
	const lines = contents
		.split(newlineRegex)
		.map(removeComments)
		.map(splitLine)
		.map(trimLine);

	const currentUserAgents = [];
	let isNoneUserAgentState = true;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!line || !line[0]) {
			continue;
		}

		switch (line[0].toLowerCase()) {
			case "user-agent":
				if (isNoneUserAgentState) {
					currentUserAgents.length = 0;
				}

				if (line[1]) {
					currentUserAgents.push(formatUserAgent(line[1]));
				}
				break;
			case "disallow":
				robots.addRule(currentUserAgents, line[1], false, i + 1);
				break;
			case "allow":
				robots.addRule(currentUserAgents, line[1], true, i + 1);
				break;
			case "crawl-delay":
				robots.setCrawlDelay(currentUserAgents, line[1]);
				break;
			case "sitemap":
				if (line[1]) {
					robots.addSitemap(line[1]);
				}
				break;
			case "host":
				if (line[1]) {
					robots.setPreferredHost(line[1].toLowerCase());
				}
				break;
		}

		isNoneUserAgentState = line[0].toLowerCase() !== "user-agent";
	}
}

/**
 * Returns if a pattern is allowed by the specified rules.
 *
 * @param  {string}  path
 * @param  {Array.<Object>}  rules
 * @return {Object?}
 * @private
 */
function findRule(path: string, rules: IRule[]) {
	let matchingRule = null;

	for (const rule of rules) {
		if (typeof rule.pattern === "string") {
			if (path.indexOf(rule.pattern) !== 0) {
				continue;
			}

			// The longest matching rule takes precedence
			if (!matchingRule || (rule as any).pattern.length > (matchingRule as any).pattern.length) {
				matchingRule = rule;
			}
			// The first matching pattern takes precedence
			// over all other rules including other patterns
		} else if (rule.pattern.test(path)) {
			return rule;
		}
	}

	return matchingRule;
}

/**
 * Converts provided string into an URL object.
 *
 * Will return null if provided string is not a valid URL.
 *
 * @param {string} urlPath
 * @return {?URL}
 * @private
 */
function parseUrl(urlPath: string) {
	try {
		return new url.URL(urlPath);
	} catch (e) {
		return null;
	}
}

export class Robots {
	public _url: url.Url;
	public _rules: {[userAgent: string]: IRule[]};
	public _crawlDelays: {[userAgent: string]: number};
	public _sitemaps: any[];
	public _preferredHost: string;
	constructor(urlPath: string, contents: string) {
		this._url = parseUrl(urlPath) || {};
		this._url.port = this._url.port || "80";

		this._rules = {};
		this._sitemaps = [];
		this._crawlDelays = {};
		this._preferredHost = null;

		parseRobots(contents || "", this);
	}

	/**
	 * Adds the specified allow/deny rule to the rules
	 * for the specified user-agents.
	 *
	 * @param {Array.<string>} userAgents
	 * @param {string} pattern
	 * @param {boolean} allow
	 * @param {number} [lineNumber] Should use 1-based indexing
	 */
	public addRule(userAgents: string[], pattern: string, allow: boolean, lineNumber: number) {
		const rules = this._rules;

		userAgents.forEach((userAgent) => {
			rules[userAgent] = rules[userAgent] || [];

			if (!pattern) {
				return;
			}

			rules[userAgent].push({
				pattern: parsePattern(pattern),
				allow,
				lineNumber
			});
		});
	}

	/**
	 * Adds the specified delay to the specified user agents.
	 *
	 * @param {Array.<string>} userAgents
	 * @param {string} delayStr
	 */
	public setCrawlDelay(userAgents: string[], delayStr: string) {
		const delay = Number(delayStr);

		userAgents.forEach((userAgent) => {
			this._rules[userAgent] = this._rules[userAgent] || [];

			if (isNaN(delay)) {
				return;
			}

			this._crawlDelays[userAgent] = delay;
		});
	}

	/**
	 * Add a sitemap
	 *
	 * @param {string} url
	 */
	public addSitemap(urlPath: string) {
		this._sitemaps.push(urlPath);
	}

	/**
	 * Sets the preferred host name
	 *
	 * @param {string} urlPath
	 */
	public setPreferredHost(urlPath: string) {
		this._preferredHost = urlPath;
	}

	public _getRule(urlPath: string, ua: string) {
		const parsedUrl = parseUrl(urlPath) || {} as url.URL;
		const userAgent = formatUserAgent(ua || "*");

		parsedUrl.port = parsedUrl.port || "80";

		// The base URL must match otherwise this robots.txt is not valid for it.
		if (parsedUrl.protocol !== this._url.protocol ||
			parsedUrl.hostname !== this._url.hostname ||
			parsedUrl.port !== this._url.port) {
			return;
		}

		const rules = this._rules[userAgent] || this._rules["*"] || [];
		const path = urlEncodeToUpper(parsedUrl.pathname + parsedUrl.search);
		const rule = findRule(path, rules);

		return rule;
	}

	/**
	 * Returns true if crawling the specified URL is allowed for the specified user-agent.
	 *
	 * Will return undefined if the URL is not valid for this robots.txt file.
	 *
	 * @param  {string}  urlPath
	 * @param  {string?}  ua
	 * @return {boolean?}
	 */
	public isAllowed(urlPath: string, ua?: string): boolean | undefined {
		const rule = this._getRule(urlPath, ua);

		if (typeof rule === "undefined") {
			return;
		}

		return !rule || rule.allow;
	}

	/**
	 * Returns the line number of the matching directive for the specified
	 * URL and user-agent if any.
	 *
	 * The line numbers start at 1 and go up (1-based indexing).
	 *
	 * Return -1 if there is no matching directive. If a rule is manually
	 * added without a lineNumber then this will return undefined for that
	 * rule.
	 *
	 * @param  {string}  urlPath
	 * @param  {string?}  ua
	 * @return {number?}
	 */
	public getMatchingLineNumber(urlPath: string, ua?: string): number | undefined {
		const rule = this._getRule(urlPath, ua);

		return rule ? rule.lineNumber : -1;
	}

	/**
	 * Returns true if crawling the specified URL is not allowed for the specified user-agent.
	 *
	 * will return `undefined` if the URL isn't valid for this robots.txt.
	 *
	 * @param  {string}  urlPath
	 * @param  {string?}  ua
	 * @return {boolean}
	 */
	public isDisallowed(urlPath?: string, ua?: string): boolean | undefined {
		return !this.isAllowed(urlPath, ua);
	}

	/**
	 * The number of seconds the specified user-agent should wait between requests.
	 *
	 * Will return undefined if there is no crawl delay set.
	 *
	 * @param  {string} ua
	 * @return {number?}
	 */
	public getCrawlDelay(ua?: string): number | undefined {
		const userAgent = formatUserAgent(ua || "*");
		const uaHasRules = this._rules[userAgent];
		if (uaHasRules) {
			return this._crawlDelays[userAgent];
		}
		return (this._crawlDelays[userAgent] || this._crawlDelays["*"]);
	}

	/**
	 * Returns the preferred host name specified by the `host:` directive or null if there isn't one.
	 *
	 * @return {string?}
	 */
	public getPreferredHost(): string | null {
		return this._preferredHost;
	}

	/**
	 * Returns an array of sitemap URLs specified by the `sitemap:` directive.
	 *
	 * @return {Array.<string>}
	 */
	public getSitemaps(): string[] {
		return this._sitemaps.slice(0);
	}

}
