export namespace service {
	
	export class AFKConfig {
	    timeoutSeconds: number;
	    minSessionMinutes: number;
	
	    static createFrom(source: any = {}) {
	        return new AFKConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timeoutSeconds = source["timeoutSeconds"];
	        this.minSessionMinutes = source["minSessionMinutes"];
	    }
	}
	export class AppUsage {
	    appName: string;
	    durationSeconds: number;
	    percentage: number;
	    focusCount: number;
	
	    static createFrom(source: any = {}) {
	        return new AppUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appName = source["appName"];
	        this.durationSeconds = source["durationSeconds"];
	        this.percentage = source["percentage"];
	        this.focusCount = source["focusCount"];
	    }
	}
	export class BrowserConfig {
	    enabled: boolean;
	    browsers: string[];
	
	    static createFrom(source: any = {}) {
	        return new BrowserConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.browsers = source["browsers"];
	    }
	}
	export class DomainUsage {
	    domain: string;
	    visitCount: number;
	
	    static createFrom(source: any = {}) {
	        return new DomainUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.domain = source["domain"];
	        this.visitCount = source["visitCount"];
	    }
	}
	export class BrowserStats {
	    totalVisits: number;
	    uniqueDomains: number;
	    topDomains: DomainUsage[];
	    browserCounts: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new BrowserStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalVisits = source["totalVisits"];
	        this.uniqueDomains = source["uniqueDomains"];
	        this.topDomains = this.convertValues(source["topDomains"], DomainUsage);
	        this.browserCounts = source["browserCounts"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BundledInferenceConfig {
	    model: string;
	
	    static createFrom(source: any = {}) {
	        return new BundledInferenceConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.model = source["model"];
	    }
	}
	export class CalendarDay {
	    date: string;
	    dayOfMonth: number;
	    screenshots: number;
	    sessions: number;
	    intensity: number;
	
	    static createFrom(source: any = {}) {
	        return new CalendarDay(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.dayOfMonth = source["dayOfMonth"];
	        this.screenshots = source["screenshots"];
	        this.sessions = source["sessions"];
	        this.intensity = source["intensity"];
	    }
	}
	export class CalendarData {
	    year: number;
	    month: number;
	    days: CalendarDay[];
	    firstDay: number;
	    totalDays: number;
	
	    static createFrom(source: any = {}) {
	        return new CalendarData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.year = source["year"];
	        this.month = source["month"];
	        this.days = this.convertValues(source["days"], CalendarDay);
	        this.firstDay = source["firstDay"];
	        this.totalDays = source["totalDays"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class CaptureConfig {
	    enabled: boolean;
	    intervalSeconds: number;
	    quality: number;
	    duplicateThreshold: number;
	
	    static createFrom(source: any = {}) {
	        return new CaptureConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.intervalSeconds = source["intervalSeconds"];
	        this.quality = source["quality"];
	        this.duplicateThreshold = source["duplicateThreshold"];
	    }
	}
	export class CloudConfig {
	    provider: string;
	    apiKey: string;
	    model: string;
	
	    static createFrom(source: any = {}) {
	        return new CloudConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.apiKey = source["apiKey"];
	        this.model = source["model"];
	    }
	}
	export class CommandUsage {
	    command: string;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new CommandUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.command = source["command"];
	        this.count = source["count"];
	    }
	}
	export class SystemConfig {
	    autoStart: boolean;
	    startOnLogin: boolean;
	    dataDir: string;
	
	    static createFrom(source: any = {}) {
	        return new SystemConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.autoStart = source["autoStart"];
	        this.startOnLogin = source["startOnLogin"];
	        this.dataDir = source["dataDir"];
	    }
	}
	export class UIConfig {
	    theme: string;
	    startMinimized: boolean;
	    showNotifications: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UIConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme = source["theme"];
	        this.startMinimized = source["startMinimized"];
	        this.showNotifications = source["showNotifications"];
	    }
	}
	export class WatchPath {
	    path: string;
	    category: string;
	    recursive: boolean;
	
	    static createFrom(source: any = {}) {
	        return new WatchPath(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.category = source["category"];
	        this.recursive = source["recursive"];
	    }
	}
	export class FilesConfig {
	    enabled: boolean;
	    watches: WatchPath[];
	
	    static createFrom(source: any = {}) {
	        return new FilesConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.watches = this.convertValues(source["watches"], WatchPath);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GitConfig {
	    enabled: boolean;
	    searchPaths: string[];
	    maxDepth: number;
	
	    static createFrom(source: any = {}) {
	        return new GitConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.searchPaths = source["searchPaths"];
	        this.maxDepth = source["maxDepth"];
	    }
	}
	export class ShellConfig {
	    enabled: boolean;
	    excludePatterns: string[];
	
	    static createFrom(source: any = {}) {
	        return new ShellConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.excludePatterns = source["excludePatterns"];
	    }
	}
	export class DataSourcesConfig {
	    shell?: ShellConfig;
	    git?: GitConfig;
	    files?: FilesConfig;
	    browser?: BrowserConfig;
	
	    static createFrom(source: any = {}) {
	        return new DataSourcesConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.shell = this.convertValues(source["shell"], ShellConfig);
	        this.git = this.convertValues(source["git"], GitConfig);
	        this.files = this.convertValues(source["files"], FilesConfig);
	        this.browser = this.convertValues(source["browser"], BrowserConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class OllamaConfig {
	    host: string;
	    model: string;
	
	    static createFrom(source: any = {}) {
	        return new OllamaConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.model = source["model"];
	    }
	}
	export class InferenceConfig {
	    engine: string;
	    bundled?: BundledInferenceConfig;
	    ollama?: OllamaConfig;
	    cloud?: CloudConfig;
	
	    static createFrom(source: any = {}) {
	        return new InferenceConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.engine = source["engine"];
	        this.bundled = this.convertValues(source["bundled"], BundledInferenceConfig);
	        this.ollama = this.convertValues(source["ollama"], OllamaConfig);
	        this.cloud = this.convertValues(source["cloud"], CloudConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Config {
	    capture?: CaptureConfig;
	    afk?: AFKConfig;
	    inference?: InferenceConfig;
	    dataSources?: DataSourcesConfig;
	    ui?: UIConfig;
	    system?: SystemConfig;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.capture = this.convertValues(source["capture"], CaptureConfig);
	        this.afk = this.convertValues(source["afk"], AFKConfig);
	        this.inference = this.convertValues(source["inference"], InferenceConfig);
	        this.dataSources = this.convertValues(source["dataSources"], DataSourcesConfig);
	        this.ui = this.convertValues(source["ui"], UIConfig);
	        this.system = this.convertValues(source["system"], SystemConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DaemonStatus {
	    running: boolean;
	    isAFK: boolean;
	    sessionId: number;
	    sessionDuration: number;
	    idleDuration: number;
	
	    static createFrom(source: any = {}) {
	        return new DaemonStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.isAFK = source["isAFK"];
	        this.sessionId = source["sessionId"];
	        this.sessionDuration = source["sessionDuration"];
	        this.idleDuration = source["idleDuration"];
	    }
	}
	export class DailyStats {
	    date: string;
	    totalScreenshots: number;
	    totalSessions: number;
	    activeMinutes: number;
	    topApps: AppUsage[];
	    shellCommands: number;
	    gitCommits: number;
	    filesModified: number;
	    sitesVisited: number;
	
	    static createFrom(source: any = {}) {
	        return new DailyStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.totalScreenshots = source["totalScreenshots"];
	        this.totalSessions = source["totalSessions"];
	        this.activeMinutes = source["activeMinutes"];
	        this.topApps = this.convertValues(source["topApps"], AppUsage);
	        this.shellCommands = source["shellCommands"];
	        this.gitCommits = source["gitCommits"];
	        this.filesModified = source["filesModified"];
	        this.sitesVisited = source["sitesVisited"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FileStats {
	    totalEvents: number;
	    eventsByType: Record<string, number>;
	    topExtensions: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new FileStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalEvents = source["totalEvents"];
	        this.eventsByType = source["eventsByType"];
	        this.topExtensions = source["topExtensions"];
	    }
	}
	export class RepoUsage {
	    repoName: string;
	    commitCount: number;
	    insertions: number;
	    deletions: number;
	
	    static createFrom(source: any = {}) {
	        return new RepoUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.repoName = source["repoName"];
	        this.commitCount = source["commitCount"];
	        this.insertions = source["insertions"];
	        this.deletions = source["deletions"];
	    }
	}
	export class GitStats {
	    totalCommits: number;
	    totalRepos: number;
	    totalInsertions: number;
	    totalDeletions: number;
	    topRepos: RepoUsage[];
	
	    static createFrom(source: any = {}) {
	        return new GitStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalCommits = source["totalCommits"];
	        this.totalRepos = source["totalRepos"];
	        this.totalInsertions = source["totalInsertions"];
	        this.totalDeletions = source["totalDeletions"];
	        this.topRepos = this.convertValues(source["topRepos"], RepoUsage);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ShellStats {
	    totalCommands: number;
	    topCommands: CommandUsage[];
	    shellTypes: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new ShellStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalCommands = source["totalCommands"];
	        this.topCommands = this.convertValues(source["topCommands"], CommandUsage);
	        this.shellTypes = source["shellTypes"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DataSourceStats {
	    shell?: ShellStats;
	    git?: GitStats;
	    files?: FileStats;
	    browser?: BrowserStats;
	
	    static createFrom(source: any = {}) {
	        return new DataSourceStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.shell = this.convertValues(source["shell"], ShellStats);
	        this.git = this.convertValues(source["git"], GitStats);
	        this.files = this.convertValues(source["files"], FileStats);
	        this.browser = this.convertValues(source["browser"], BrowserStats);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	
	
	
	export class HourlyActivity {
	    hour: number;
	    screenshotCount: number;
	    activeMinutes: number;
	
	    static createFrom(source: any = {}) {
	        return new HourlyActivity(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hour = source["hour"];
	        this.screenshotCount = source["screenshotCount"];
	        this.activeMinutes = source["activeMinutes"];
	    }
	}
	export class HourlyFocus {
	    hour: number;
	    contextSwitches: number;
	    focusQuality: number;
	    focusLabel: string;
	
	    static createFrom(source: any = {}) {
	        return new HourlyFocus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hour = source["hour"];
	        this.contextSwitches = source["contextSwitches"];
	        this.focusQuality = source["focusQuality"];
	        this.focusLabel = source["focusLabel"];
	    }
	}
	
	export class WeekStats {
	    weekNumber: number;
	    startDate: string;
	    endDate: string;
	    totalActive: number;
	    activeDays: number;
	
	    static createFrom(source: any = {}) {
	        return new WeekStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.weekNumber = source["weekNumber"];
	        this.startDate = source["startDate"];
	        this.endDate = source["endDate"];
	        this.totalActive = source["totalActive"];
	        this.activeDays = source["activeDays"];
	    }
	}
	export class MonthlyStats {
	    year: number;
	    month: number;
	    startDate: string;
	    endDate: string;
	    dailyStats: DailyStats[];
	    weeklyStats: WeekStats[];
	    totalActive: number;
	    averages?: DailyStats;
	
	    static createFrom(source: any = {}) {
	        return new MonthlyStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.year = source["year"];
	        this.month = source["month"];
	        this.startDate = source["startDate"];
	        this.endDate = source["endDate"];
	        this.dailyStats = this.convertValues(source["dailyStats"], DailyStats);
	        this.weeklyStats = this.convertValues(source["weeklyStats"], WeekStats);
	        this.totalActive = source["totalActive"];
	        this.averages = this.convertValues(source["averages"], DailyStats);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ProductivityScore {
	    score: number;
	    productiveMinutes: number;
	    neutralMinutes: number;
	    distractingMinutes: number;
	    totalMinutes: number;
	    productivePercentage: number;
	
	    static createFrom(source: any = {}) {
	        return new ProductivityScore(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.score = source["score"];
	        this.productiveMinutes = source["productiveMinutes"];
	        this.neutralMinutes = source["neutralMinutes"];
	        this.distractingMinutes = source["distractingMinutes"];
	        this.totalMinutes = source["totalMinutes"];
	        this.productivePercentage = source["productivePercentage"];
	    }
	}
	
	export class ReportMeta {
	    id: number;
	    title: string;
	    timeRange: string;
	    reportType: string;
	    format: string;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new ReportMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.timeRange = source["timeRange"];
	        this.reportType = source["reportType"];
	        this.format = source["format"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ScreenshotInfo {
	    id: number;
	    timestamp: number;
	    filepath: string;
	    thumbnailPath: string;
	    width: number;
	    height: number;
	    windowTitle: string;
	    appName: string;
	    sessionId: number;
	    fileSize: number;
	
	    static createFrom(source: any = {}) {
	        return new ScreenshotInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.timestamp = source["timestamp"];
	        this.filepath = source["filepath"];
	        this.thumbnailPath = source["thumbnailPath"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.windowTitle = source["windowTitle"];
	        this.appName = source["appName"];
	        this.sessionId = source["sessionId"];
	        this.fileSize = source["fileSize"];
	    }
	}
	export class ScreenshotPage {
	    screenshots: storage.Screenshot[];
	    total: number;
	    page: number;
	    perPage: number;
	    totalPages: number;
	
	    static createFrom(source: any = {}) {
	        return new ScreenshotPage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.screenshots = this.convertValues(source["screenshots"], storage.Screenshot);
	        this.total = source["total"];
	        this.page = source["page"];
	        this.perPage = source["perPage"];
	        this.totalPages = source["totalPages"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SessionContext {
	    session?: storage.Session;
	    summary?: storage.Summary;
	    screenshots: storage.Screenshot[];
	    focusEvents: storage.WindowFocusEvent[];
	    shellCommands: storage.ShellCommand[];
	    gitCommits: storage.GitCommit[];
	    fileEvents: storage.FileEvent[];
	    browserVisits: storage.BrowserVisit[];
	
	    static createFrom(source: any = {}) {
	        return new SessionContext(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.session = this.convertValues(source["session"], storage.Session);
	        this.summary = this.convertValues(source["summary"], storage.Summary);
	        this.screenshots = this.convertValues(source["screenshots"], storage.Screenshot);
	        this.focusEvents = this.convertValues(source["focusEvents"], storage.WindowFocusEvent);
	        this.shellCommands = this.convertValues(source["shellCommands"], storage.ShellCommand);
	        this.gitCommits = this.convertValues(source["gitCommits"], storage.GitCommit);
	        this.fileEvents = this.convertValues(source["fileEvents"], storage.FileEvent);
	        this.browserVisits = this.convertValues(source["browserVisits"], storage.BrowserVisit);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SessionSummary {
	    id: number;
	    startTime: number;
	    endTime?: number;
	    durationSeconds?: number;
	    isOngoing: boolean;
	    screenshotCount: number;
	    summary: string;
	    explanation: string;
	    confidence: string;
	    tags: string[];
	    topApps: string[];
	    hasShell: boolean;
	    hasGit: boolean;
	    hasFiles: boolean;
	    hasBrowser: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SessionSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	        this.durationSeconds = source["durationSeconds"];
	        this.isOngoing = source["isOngoing"];
	        this.screenshotCount = source["screenshotCount"];
	        this.summary = source["summary"];
	        this.explanation = source["explanation"];
	        this.confidence = source["confidence"];
	        this.tags = source["tags"];
	        this.topApps = source["topApps"];
	        this.hasShell = source["hasShell"];
	        this.hasGit = source["hasGit"];
	        this.hasFiles = source["hasFiles"];
	        this.hasBrowser = source["hasBrowser"];
	    }
	}
	
	
	export class StorageStats {
	    screenshotCount: number;
	    sessionCount: number;
	    summaryCount: number;
	    shellCommandCount: number;
	    gitCommitCount: number;
	    fileEventCount: number;
	    browserVisitCount: number;
	    databaseSize: number;
	    screenshotsSize: number;
	
	    static createFrom(source: any = {}) {
	        return new StorageStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.screenshotCount = source["screenshotCount"];
	        this.sessionCount = source["sessionCount"];
	        this.summaryCount = source["summaryCount"];
	        this.shellCommandCount = source["shellCommandCount"];
	        this.gitCommitCount = source["gitCommitCount"];
	        this.fileEventCount = source["fileEventCount"];
	        this.browserVisitCount = source["browserVisitCount"];
	        this.databaseSize = source["databaseSize"];
	        this.screenshotsSize = source["screenshotsSize"];
	    }
	}
	
	export class TagUsage {
	    tag: string;
	    sessionCount: number;
	    totalMinutes: number;
	    percentage: number;
	
	    static createFrom(source: any = {}) {
	        return new TagUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tag = source["tag"];
	        this.sessionCount = source["sessionCount"];
	        this.totalMinutes = source["totalMinutes"];
	        this.percentage = source["percentage"];
	    }
	}
	export class TimeRange {
	    start: number;
	    end: number;
	    startDate: string;
	    endDate: string;
	    label: string;
	
	    static createFrom(source: any = {}) {
	        return new TimeRange(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.start = source["start"];
	        this.end = source["end"];
	        this.startDate = source["startDate"];
	        this.endDate = source["endDate"];
	        this.label = source["label"];
	    }
	}
	
	
	
	export class WeeklyStats {
	    startDate: string;
	    endDate: string;
	    dailyStats: DailyStats[];
	    totalActive: number;
	    averages?: DailyStats;
	
	    static createFrom(source: any = {}) {
	        return new WeeklyStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.startDate = source["startDate"];
	        this.endDate = source["endDate"];
	        this.dailyStats = this.convertValues(source["dailyStats"], DailyStats);
	        this.totalActive = source["totalActive"];
	        this.averages = this.convertValues(source["averages"], DailyStats);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WindowUsage {
	    windowTitle: string;
	    appName: string;
	    durationSeconds: number;
	    percentage: number;
	    focusCount: number;
	
	    static createFrom(source: any = {}) {
	        return new WindowUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.windowTitle = source["windowTitle"];
	        this.appName = source["appName"];
	        this.durationSeconds = source["durationSeconds"];
	        this.percentage = source["percentage"];
	        this.focusCount = source["focusCount"];
	    }
	}

}

export namespace sql {
	
	export class NullFloat64 {
	    Float64: number;
	    Valid: boolean;
	
	    static createFrom(source: any = {}) {
	        return new NullFloat64(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Float64 = source["Float64"];
	        this.Valid = source["Valid"];
	    }
	}
	export class NullInt64 {
	    Int64: number;
	    Valid: boolean;
	
	    static createFrom(source: any = {}) {
	        return new NullInt64(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Int64 = source["Int64"];
	        this.Valid = source["Valid"];
	    }
	}
	export class NullString {
	    String: string;
	    Valid: boolean;
	
	    static createFrom(source: any = {}) {
	        return new NullString(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.String = source["String"];
	        this.Valid = source["Valid"];
	    }
	}

}

export namespace storage {
	
	export class BrowserVisit {
	    id: number;
	    timestamp: number;
	    url: string;
	    title: sql.NullString;
	    domain: string;
	    browser: string;
	    visitDurationSeconds: sql.NullInt64;
	    transitionType: sql.NullString;
	    sessionId: sql.NullInt64;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new BrowserVisit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.timestamp = source["timestamp"];
	        this.url = source["url"];
	        this.title = this.convertValues(source["title"], sql.NullString);
	        this.domain = source["domain"];
	        this.browser = source["browser"];
	        this.visitDurationSeconds = this.convertValues(source["visitDurationSeconds"], sql.NullInt64);
	        this.transitionType = this.convertValues(source["transitionType"], sql.NullString);
	        this.sessionId = this.convertValues(source["sessionId"], sql.NullInt64);
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FileEvent {
	    id: number;
	    timestamp: number;
	    eventType: string;
	    filePath: string;
	    fileName: string;
	    directory: string;
	    fileExtension: sql.NullString;
	    fileSizeBytes: sql.NullInt64;
	    watchCategory: string;
	    oldPath: sql.NullString;
	    sessionId: sql.NullInt64;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new FileEvent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.timestamp = source["timestamp"];
	        this.eventType = source["eventType"];
	        this.filePath = source["filePath"];
	        this.fileName = source["fileName"];
	        this.directory = source["directory"];
	        this.fileExtension = this.convertValues(source["fileExtension"], sql.NullString);
	        this.fileSizeBytes = this.convertValues(source["fileSizeBytes"], sql.NullInt64);
	        this.watchCategory = source["watchCategory"];
	        this.oldPath = this.convertValues(source["oldPath"], sql.NullString);
	        this.sessionId = this.convertValues(source["sessionId"], sql.NullInt64);
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GitCommit {
	    id: number;
	    timestamp: number;
	    commitHash: string;
	    shortHash: string;
	    repositoryId: number;
	    branch: sql.NullString;
	    message: string;
	    messageSubject: string;
	    filesChanged: sql.NullInt64;
	    insertions: sql.NullInt64;
	    deletions: sql.NullInt64;
	    authorName: sql.NullString;
	    authorEmail: sql.NullString;
	    isMerge: boolean;
	    sessionId: sql.NullInt64;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new GitCommit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.timestamp = source["timestamp"];
	        this.commitHash = source["commitHash"];
	        this.shortHash = source["shortHash"];
	        this.repositoryId = source["repositoryId"];
	        this.branch = this.convertValues(source["branch"], sql.NullString);
	        this.message = source["message"];
	        this.messageSubject = source["messageSubject"];
	        this.filesChanged = this.convertValues(source["filesChanged"], sql.NullInt64);
	        this.insertions = this.convertValues(source["insertions"], sql.NullInt64);
	        this.deletions = this.convertValues(source["deletions"], sql.NullInt64);
	        this.authorName = this.convertValues(source["authorName"], sql.NullString);
	        this.authorEmail = this.convertValues(source["authorEmail"], sql.NullString);
	        this.isMerge = source["isMerge"];
	        this.sessionId = this.convertValues(source["sessionId"], sql.NullInt64);
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GitRepository {
	    id: number;
	    path: string;
	    name: string;
	    remoteUrl: sql.NullString;
	    lastScanned: sql.NullInt64;
	    isActive: boolean;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new GitRepository(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.path = source["path"];
	        this.name = source["name"];
	        this.remoteUrl = this.convertValues(source["remoteUrl"], sql.NullString);
	        this.lastScanned = this.convertValues(source["lastScanned"], sql.NullInt64);
	        this.isActive = source["isActive"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Report {
	    id: number;
	    title: string;
	    timeRange: string;
	    reportType: string;
	    format: string;
	    content: sql.NullString;
	    filepath: sql.NullString;
	    startTime: sql.NullInt64;
	    endTime: sql.NullInt64;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Report(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.timeRange = source["timeRange"];
	        this.reportType = source["reportType"];
	        this.format = source["format"];
	        this.content = this.convertValues(source["content"], sql.NullString);
	        this.filepath = this.convertValues(source["filepath"], sql.NullString);
	        this.startTime = this.convertValues(source["startTime"], sql.NullInt64);
	        this.endTime = this.convertValues(source["endTime"], sql.NullInt64);
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Screenshot {
	    id: number;
	    timestamp: number;
	    filepath: string;
	    dhash: string;
	    windowTitle: sql.NullString;
	    appName: sql.NullString;
	    windowX: sql.NullInt64;
	    windowY: sql.NullInt64;
	    windowWidth: sql.NullInt64;
	    windowHeight: sql.NullInt64;
	    monitorName: sql.NullString;
	    monitorWidth: sql.NullInt64;
	    monitorHeight: sql.NullInt64;
	    sessionId: sql.NullInt64;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Screenshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.timestamp = source["timestamp"];
	        this.filepath = source["filepath"];
	        this.dhash = source["dhash"];
	        this.windowTitle = this.convertValues(source["windowTitle"], sql.NullString);
	        this.appName = this.convertValues(source["appName"], sql.NullString);
	        this.windowX = this.convertValues(source["windowX"], sql.NullInt64);
	        this.windowY = this.convertValues(source["windowY"], sql.NullInt64);
	        this.windowWidth = this.convertValues(source["windowWidth"], sql.NullInt64);
	        this.windowHeight = this.convertValues(source["windowHeight"], sql.NullInt64);
	        this.monitorName = this.convertValues(source["monitorName"], sql.NullString);
	        this.monitorWidth = this.convertValues(source["monitorWidth"], sql.NullInt64);
	        this.monitorHeight = this.convertValues(source["monitorHeight"], sql.NullInt64);
	        this.sessionId = this.convertValues(source["sessionId"], sql.NullInt64);
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Session {
	    id: number;
	    startTime: number;
	    endTime: sql.NullInt64;
	    durationSeconds: sql.NullInt64;
	    screenshotCount: number;
	    summaryId: sql.NullInt64;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Session(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.startTime = source["startTime"];
	        this.endTime = this.convertValues(source["endTime"], sql.NullInt64);
	        this.durationSeconds = this.convertValues(source["durationSeconds"], sql.NullInt64);
	        this.screenshotCount = source["screenshotCount"];
	        this.summaryId = this.convertValues(source["summaryId"], sql.NullInt64);
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ShellCommand {
	    id: number;
	    timestamp: number;
	    command: string;
	    shellType: string;
	    workingDirectory: sql.NullString;
	    exitCode: sql.NullInt64;
	    durationSeconds: sql.NullFloat64;
	    hostname: sql.NullString;
	    sessionId: sql.NullInt64;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new ShellCommand(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.timestamp = source["timestamp"];
	        this.command = source["command"];
	        this.shellType = source["shellType"];
	        this.workingDirectory = this.convertValues(source["workingDirectory"], sql.NullString);
	        this.exitCode = this.convertValues(source["exitCode"], sql.NullInt64);
	        this.durationSeconds = this.convertValues(source["durationSeconds"], sql.NullFloat64);
	        this.hostname = this.convertValues(source["hostname"], sql.NullString);
	        this.sessionId = this.convertValues(source["sessionId"], sql.NullInt64);
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Summary {
	    id: number;
	    sessionId: sql.NullInt64;
	    summary: string;
	    explanation: sql.NullString;
	    confidence: sql.NullString;
	    tags: string[];
	    modelUsed: string;
	    inferenceTimeMs: sql.NullInt64;
	    screenshotIds: number[];
	    contextJson: sql.NullString;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Summary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sessionId = this.convertValues(source["sessionId"], sql.NullInt64);
	        this.summary = source["summary"];
	        this.explanation = this.convertValues(source["explanation"], sql.NullString);
	        this.confidence = this.convertValues(source["confidence"], sql.NullString);
	        this.tags = source["tags"];
	        this.modelUsed = source["modelUsed"];
	        this.inferenceTimeMs = this.convertValues(source["inferenceTimeMs"], sql.NullInt64);
	        this.screenshotIds = source["screenshotIds"];
	        this.contextJson = this.convertValues(source["contextJson"], sql.NullString);
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WindowFocusEvent {
	    id: number;
	    windowTitle: string;
	    appName: string;
	    windowClass: sql.NullString;
	    startTime: number;
	    endTime: number;
	    durationSeconds: number;
	    sessionId: sql.NullInt64;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new WindowFocusEvent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.windowTitle = source["windowTitle"];
	        this.appName = source["appName"];
	        this.windowClass = this.convertValues(source["windowClass"], sql.NullString);
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	        this.durationSeconds = source["durationSeconds"];
	        this.sessionId = this.convertValues(source["sessionId"], sql.NullInt64);
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

