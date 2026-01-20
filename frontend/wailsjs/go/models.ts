export namespace inference {
	
	export class BundledStatus {
	    available: boolean;
	    running: boolean;
	    modelDownloaded: boolean;
	    serverInstalled: boolean;
	    modelPath: string;
	    serverPath: string;
	    port: number;
	
	    static createFrom(source: any = {}) {
	        return new BundledStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.running = source["running"];
	        this.modelDownloaded = source["modelDownloaded"];
	        this.serverInstalled = source["serverInstalled"];
	        this.modelPath = source["modelPath"];
	        this.serverPath = source["serverPath"];
	        this.port = source["port"];
	    }
	}
	export class InferenceStatus {
	    engine: string;
	    available: boolean;
	    modelName: string;
	    bundledRunning?: boolean;
	    bundledReady?: boolean;
	    ollamaConnected?: boolean;
	    cloudConfigured?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new InferenceStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.engine = source["engine"];
	        this.available = source["available"];
	        this.modelName = source["modelName"];
	        this.bundledRunning = source["bundledRunning"];
	        this.bundledReady = source["bundledReady"];
	        this.ollamaConnected = source["ollamaConnected"];
	        this.cloudConfigured = source["cloudConfigured"];
	    }
	}
	export class ModelInfo {
	    id: string;
	    name: string;
	    description: string;
	    size: number;
	    downloaded: boolean;
	    downloadUrl: string;
	    filename: string;
	
	    static createFrom(source: any = {}) {
	        return new ModelInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.size = source["size"];
	        this.downloaded = source["downloaded"];
	        this.downloadUrl = source["downloadUrl"];
	        this.filename = source["filename"];
	    }
	}
	export class ServerDownloadStatus {
	    installed: boolean;
	    serverPath: string;
	    version: string;
	    downloadUrl?: string;
	    size?: number;
	
	    static createFrom(source: any = {}) {
	        return new ServerDownloadStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.installed = source["installed"];
	        this.serverPath = source["serverPath"];
	        this.version = source["version"];
	        this.downloadUrl = source["downloadUrl"];
	        this.size = source["size"];
	    }
	}
	export class SetupStatus {
	    ready: boolean;
	    engine: string;
	    issue?: string;
	    suggestion?: string;
	
	    static createFrom(source: any = {}) {
	        return new SetupStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ready = source["ready"];
	        this.engine = source["engine"];
	        this.issue = source["issue"];
	        this.suggestion = source["suggestion"];
	    }
	}

}

export namespace main {
	
	export class AppWithCategory {
	    appName: string;
	    category: string;
	
	    static createFrom(source: any = {}) {
	        return new AppWithCategory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appName = source["appName"];
	        this.category = source["category"];
	    }
	}
	export class BulkAssignment {
	    eventType: string;
	    eventId: number;
	    projectId: number;
	
	    static createFrom(source: any = {}) {
	        return new BulkAssignment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.eventType = source["eventType"];
	        this.eventId = source["eventId"];
	        this.projectId = source["projectId"];
	    }
	}

}

export namespace service {
	
	export class AFKBlock {
	    id: number;
	    startTime: number;
	    endTime: number;
	    durationSeconds: number;
	    triggerType: string;
	    hourOffset: number;
	    minuteOffset: number;
	    pixelPosition: number;
	    pixelHeight: number;
	
	    static createFrom(source: any = {}) {
	        return new AFKBlock(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	        this.durationSeconds = source["durationSeconds"];
	        this.triggerType = source["triggerType"];
	        this.hourOffset = source["hourOffset"];
	        this.minuteOffset = source["minuteOffset"];
	        this.pixelPosition = source["pixelPosition"];
	        this.pixelHeight = source["pixelHeight"];
	    }
	}
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
	export class ActivityBlock {
	    id: number;
	    windowTitle: string;
	    appName: string;
	    startTime: number;
	    endTime: number;
	    durationSeconds: number;
	    category: string;
	    hourOffset: number;
	    minuteOffset: number;
	    pixelPosition: number;
	    pixelHeight: number;
	    projectId?: number;
	    projectColor?: string;
	    projectSource?: string;
	    projectConfidence?: number;
	
	    static createFrom(source: any = {}) {
	        return new ActivityBlock(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.windowTitle = source["windowTitle"];
	        this.appName = source["appName"];
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	        this.durationSeconds = source["durationSeconds"];
	        this.category = source["category"];
	        this.hourOffset = source["hourOffset"];
	        this.minuteOffset = source["minuteOffset"];
	        this.pixelPosition = source["pixelPosition"];
	        this.pixelHeight = source["pixelHeight"];
	        this.projectId = source["projectId"];
	        this.projectColor = source["projectColor"];
	        this.projectSource = source["projectSource"];
	        this.projectConfidence = source["projectConfidence"];
	    }
	}
	export class ActivityCluster {
	    id: string;
	    startTime: number;
	    endTime: number;
	    hourOffset: number;
	    minuteOffset: number;
	    pixelPosition: number;
	    pixelHeight: number;
	    eventCount: number;
	    gitEventIds: number[];
	    shellEventIds: number[];
	    fileEventIds: number[];
	    browserEventIds: number[];
	    summary: string;
	
	    static createFrom(source: any = {}) {
	        return new ActivityCluster(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	        this.hourOffset = source["hourOffset"];
	        this.minuteOffset = source["minuteOffset"];
	        this.pixelPosition = source["pixelPosition"];
	        this.pixelHeight = source["pixelHeight"];
	        this.eventCount = source["eventCount"];
	        this.gitEventIds = source["gitEventIds"];
	        this.shellEventIds = source["shellEventIds"];
	        this.fileEventIds = source["fileEventIds"];
	        this.browserEventIds = source["browserEventIds"];
	        this.summary = source["summary"];
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
	export class AssignmentResult {
	    projectId: number;
	    projectName: string;
	    color: string;
	    confidence: number;
	    source: string;
	    reason: string;
	
	    static createFrom(source: any = {}) {
	        return new AssignmentResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.projectId = source["projectId"];
	        this.projectName = source["projectName"];
	        this.color = source["color"];
	        this.confidence = source["confidence"];
	        this.source = source["source"];
	        this.reason = source["reason"];
	    }
	}
	export class BackfillResult {
	    totalProcessed: number;
	    autoAssigned: number;
	    alreadyAssigned: number;
	    noMatch: number;
	
	    static createFrom(source: any = {}) {
	        return new BackfillResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalProcessed = source["totalProcessed"];
	        this.autoAssigned = source["autoAssigned"];
	        this.alreadyAssigned = source["alreadyAssigned"];
	        this.noMatch = source["noMatch"];
	    }
	}
	export class BrowserConfig {
	    enabled: boolean;
	    browsers: string[];
	    excludedDomains: string[];
	    historyLimitDays: number;
	
	    static createFrom(source: any = {}) {
	        return new BrowserConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.browsers = source["browsers"];
	        this.excludedDomains = source["excludedDomains"];
	        this.historyLimitDays = source["historyLimitDays"];
	    }
	}
	export class BrowserEventDisplay {
	    id: number;
	    timestamp: number;
	    url: string;
	    title: string;
	    domain: string;
	    browser: string;
	    visitDurationSeconds: number;
	    transitionType: string;
	    hourOffset: number;
	    minuteOffset: number;
	    pixelPosition: number;
	
	    static createFrom(source: any = {}) {
	        return new BrowserEventDisplay(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.timestamp = source["timestamp"];
	        this.url = source["url"];
	        this.title = source["title"];
	        this.domain = source["domain"];
	        this.browser = source["browser"];
	        this.visitDurationSeconds = source["visitDurationSeconds"];
	        this.transitionType = source["transitionType"];
	        this.hourOffset = source["hourOffset"];
	        this.minuteOffset = source["minuteOffset"];
	        this.pixelPosition = source["pixelPosition"];
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
	    monitorMode: string;
	    monitorIndex: number;
	
	    static createFrom(source: any = {}) {
	        return new CaptureConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.intervalSeconds = source["intervalSeconds"];
	        this.quality = source["quality"];
	        this.duplicateThreshold = source["duplicateThreshold"];
	        this.monitorMode = source["monitorMode"];
	        this.monitorIndex = source["monitorIndex"];
	    }
	}
	export class CloudConfig {
	    provider: string;
	    apiKey: string;
	    model: string;
	    endpoint: string;
	
	    static createFrom(source: any = {}) {
	        return new CloudConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.apiKey = source["apiKey"];
	        this.model = source["model"];
	        this.endpoint = source["endpoint"];
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
	export class Comparison {
	    screenshotsDiff: number;
	    screenshotsPercent: number;
	    sessionsDiff: number;
	    sessionsPercent: number;
	    activeMinutesDiff: number;
	    activeMinutesPercent: number;
	    shellCommandsDiff: number;
	    shellCommandsPercent: number;
	    gitCommitsDiff: number;
	    gitCommitsPercent: number;
	    filesModifiedDiff: number;
	    filesModifiedPercent: number;
	    sitesVisitedDiff: number;
	    sitesVisitedPercent: number;
	
	    static createFrom(source: any = {}) {
	        return new Comparison(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.screenshotsDiff = source["screenshotsDiff"];
	        this.screenshotsPercent = source["screenshotsPercent"];
	        this.sessionsDiff = source["sessionsDiff"];
	        this.sessionsPercent = source["sessionsPercent"];
	        this.activeMinutesDiff = source["activeMinutesDiff"];
	        this.activeMinutesPercent = source["activeMinutesPercent"];
	        this.shellCommandsDiff = source["shellCommandsDiff"];
	        this.shellCommandsPercent = source["shellCommandsPercent"];
	        this.gitCommitsDiff = source["gitCommitsDiff"];
	        this.gitCommitsPercent = source["gitCommitsPercent"];
	        this.filesModifiedDiff = source["filesModifiedDiff"];
	        this.filesModifiedPercent = source["filesModifiedPercent"];
	        this.sitesVisitedDiff = source["sitesVisitedDiff"];
	        this.sitesVisitedPercent = source["sitesVisitedPercent"];
	    }
	}
	export class TimelineConfig {
	    minActivityDurationSeconds: number;
	
	    static createFrom(source: any = {}) {
	        return new TimelineConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.minActivityDurationSeconds = source["minActivityDurationSeconds"];
	    }
	}
	export class UpdateConfig {
	    autoUpdate: boolean;
	    checkIntervalHours: number;
	    afkRestartMinutes: number;
	
	    static createFrom(source: any = {}) {
	        return new UpdateConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.autoUpdate = source["autoUpdate"];
	        this.checkIntervalHours = source["checkIntervalHours"];
	        this.afkRestartMinutes = source["afkRestartMinutes"];
	    }
	}
	export class IssuesConfig {
	    crashReportingEnabled: boolean;
	    webhookEnabled: boolean;
	    webhookUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new IssuesConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.crashReportingEnabled = source["crashReportingEnabled"];
	        this.webhookEnabled = source["webhookEnabled"];
	        this.webhookUrl = source["webhookUrl"];
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
	    excludePatterns: string[];
	    allowedExtensions: string[];
	
	    static createFrom(source: any = {}) {
	        return new FilesConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.watches = this.convertValues(source["watches"], WatchPath);
	        this.excludePatterns = source["excludePatterns"];
	        this.allowedExtensions = source["allowedExtensions"];
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
	    shellType: string;
	    historyPath: string;
	    excludePatterns: string[];
	
	    static createFrom(source: any = {}) {
	        return new ShellConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.shellType = source["shellType"];
	        this.historyPath = source["historyPath"];
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
	    issues?: IssuesConfig;
	    update?: UpdateConfig;
	    timeline?: TimelineConfig;
	
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
	        this.issues = this.convertValues(source["issues"], IssuesConfig);
	        this.update = this.convertValues(source["update"], UpdateConfig);
	        this.timeline = this.convertValues(source["timeline"], TimelineConfig);
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
	    comparison?: Comparison;
	
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
	        this.comparison = this.convertValues(source["comparison"], Comparison);
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
	export class CustomRangeStats {
	    startDate: string;
	    endDate: string;
	    bucketType: string;
	    totalActive: number;
	    averages?: DailyStats;
	    hourlyBuckets?: HourlyActivity[];
	    dailyBuckets?: DailyStats[];
	    weeklyBuckets?: WeekStats[];
	
	    static createFrom(source: any = {}) {
	        return new CustomRangeStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.startDate = source["startDate"];
	        this.endDate = source["endDate"];
	        this.bucketType = source["bucketType"];
	        this.totalActive = source["totalActive"];
	        this.averages = this.convertValues(source["averages"], DailyStats);
	        this.hourlyBuckets = this.convertValues(source["hourlyBuckets"], HourlyActivity);
	        this.dailyBuckets = this.convertValues(source["dailyBuckets"], DailyStats);
	        this.weeklyBuckets = this.convertValues(source["weeklyBuckets"], WeekStats);
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
	    paused: boolean;
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
	        this.paused = source["paused"];
	        this.isAFK = source["isAFK"];
	        this.sessionId = source["sessionId"];
	        this.sessionDuration = source["sessionDuration"];
	        this.idleDuration = source["idleDuration"];
	    }
	}
	
	export class DailySummary {
	    id: number;
	    date: string;
	    summary: string;
	    totalTime: number;
	    sessionsCount: number;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new DailySummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.date = source["date"];
	        this.summary = source["summary"];
	        this.totalTime = source["totalTime"];
	        this.sessionsCount = source["sessionsCount"];
	        this.createdAt = source["createdAt"];
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
	
	export class DaySpan {
	    startTime: number;
	    endTime: number;
	    spanHours: number;
	
	    static createFrom(source: any = {}) {
	        return new DaySpan(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	        this.spanHours = source["spanHours"];
	    }
	}
	export class DayStats {
	    totalSeconds: number;
	    totalHours: number;
	    breakCount: number;
	    breakDuration: number;
	    longestFocus: number;
	    timeSinceLastBreak: number;
	    daySpan?: DaySpan;
	    breakdown: Record<string, number>;
	    breakdownPercent: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new DayStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalSeconds = source["totalSeconds"];
	        this.totalHours = source["totalHours"];
	        this.breakCount = source["breakCount"];
	        this.breakDuration = source["breakDuration"];
	        this.longestFocus = source["longestFocus"];
	        this.timeSinceLastBreak = source["timeSinceLastBreak"];
	        this.daySpan = this.convertValues(source["daySpan"], DaySpan);
	        this.breakdown = source["breakdown"];
	        this.breakdownPercent = source["breakdownPercent"];
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
	
	export class EntryBlock {
	    id: number;
	    eventType: string;
	    projectId: number;
	    projectName: string;
	    projectColor: string;
	    appName: string;
	    windowTitle: string;
	    startTime: number;
	    endTime: number;
	    durationSeconds: number;
	    confidence: number;
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new EntryBlock(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.eventType = source["eventType"];
	        this.projectId = source["projectId"];
	        this.projectName = source["projectName"];
	        this.projectColor = source["projectColor"];
	        this.appName = source["appName"];
	        this.windowTitle = source["windowTitle"];
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	        this.durationSeconds = source["durationSeconds"];
	        this.confidence = source["confidence"];
	        this.source = source["source"];
	    }
	}
	export class FileEventDisplay {
	    id: number;
	    timestamp: number;
	    eventType: string;
	    filePath: string;
	    fileName: string;
	    directory: string;
	    fileExtension: string;
	    fileSizeBytes: number;
	    watchCategory: string;
	    oldPath: string;
	    hourOffset: number;
	    minuteOffset: number;
	    pixelPosition: number;
	
	    static createFrom(source: any = {}) {
	        return new FileEventDisplay(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.timestamp = source["timestamp"];
	        this.eventType = source["eventType"];
	        this.filePath = source["filePath"];
	        this.fileName = source["fileName"];
	        this.directory = source["directory"];
	        this.fileExtension = source["fileExtension"];
	        this.fileSizeBytes = source["fileSizeBytes"];
	        this.watchCategory = source["watchCategory"];
	        this.oldPath = source["oldPath"];
	        this.hourOffset = source["hourOffset"];
	        this.minuteOffset = source["minuteOffset"];
	        this.pixelPosition = source["pixelPosition"];
	    }
	}
	
	
	
	export class GitEventDisplay {
	    id: number;
	    timestamp: number;
	    message: string;
	    messageSubject: string;
	    shortHash: string;
	    repository: string;
	    branch: string;
	    insertions: number;
	    deletions: number;
	    hourOffset: number;
	    minuteOffset: number;
	    pixelPosition: number;
	
	    static createFrom(source: any = {}) {
	        return new GitEventDisplay(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.timestamp = source["timestamp"];
	        this.message = source["message"];
	        this.messageSubject = source["messageSubject"];
	        this.shortHash = source["shortHash"];
	        this.repository = source["repository"];
	        this.branch = source["branch"];
	        this.insertions = source["insertions"];
	        this.deletions = source["deletions"];
	        this.hourOffset = source["hourOffset"];
	        this.minuteOffset = source["minuteOffset"];
	        this.pixelPosition = source["pixelPosition"];
	    }
	}
	
	export class HeatmapData {
	    dayOfWeek: number;
	    hour: number;
	    value: number;
	
	    static createFrom(source: any = {}) {
	        return new HeatmapData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dayOfWeek = source["dayOfWeek"];
	        this.hour = source["hour"];
	        this.value = source["value"];
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
	
	export class IssueReport {
	    id: number;
	    reportType: string;
	    errorMessage: string;
	    stackTrace: string;
	    screenshotIds: number[];
	    sessionId: number;
	    userDescription: string;
	    appVersion: string;
	    pageRoute: string;
	    webhookSent: boolean;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new IssueReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.reportType = source["reportType"];
	        this.errorMessage = source["errorMessage"];
	        this.stackTrace = source["stackTrace"];
	        this.screenshotIds = source["screenshotIds"];
	        this.sessionId = source["sessionId"];
	        this.userDescription = source["userDescription"];
	        this.appVersion = source["appVersion"];
	        this.pageRoute = source["pageRoute"];
	        this.webhookSent = source["webhookSent"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	export class MonthStats {
	    monthNumber: number;
	    monthName: string;
	    startDate: string;
	    endDate: string;
	    totalActive: number;
	    activeDays: number;
	    sessions: number;
	    screenshots: number;
	
	    static createFrom(source: any = {}) {
	        return new MonthStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.monthNumber = source["monthNumber"];
	        this.monthName = source["monthName"];
	        this.startDate = source["startDate"];
	        this.endDate = source["endDate"];
	        this.totalActive = source["totalActive"];
	        this.activeDays = source["activeDays"];
	        this.sessions = source["sessions"];
	        this.screenshots = source["screenshots"];
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
	
	export class Report {
	    id: number;
	    title: string;
	    timeRange: string;
	    reportType: string;
	    format: string;
	    content: string;
	    filepath: string;
	    startTime: number;
	    endTime: number;
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
	        this.content = source["content"];
	        this.filepath = source["filepath"];
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	        this.createdAt = source["createdAt"];
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
	export class ScreenshotDisplay {
	    id: number;
	    timestamp: number;
	    filepath: string;
	    windowTitle: string;
	    appName: string;
	    sessionId: number;
	    monitorWidth: number;
	    monitorHeight: number;
	
	    static createFrom(source: any = {}) {
	        return new ScreenshotDisplay(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.timestamp = source["timestamp"];
	        this.filepath = source["filepath"];
	        this.windowTitle = source["windowTitle"];
	        this.appName = source["appName"];
	        this.sessionId = source["sessionId"];
	        this.monitorWidth = source["monitorWidth"];
	        this.monitorHeight = source["monitorHeight"];
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
	    screenshots: ScreenshotDisplay[];
	    total: number;
	    page: number;
	    perPage: number;
	    totalPages: number;
	    hasMore: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ScreenshotPage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.screenshots = this.convertValues(source["screenshots"], ScreenshotDisplay);
	        this.total = source["total"];
	        this.page = source["page"];
	        this.perPage = source["perPage"];
	        this.totalPages = source["totalPages"];
	        this.hasMore = source["hasMore"];
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
	export class SearchResult {
	    type: string;
	    id: number;
	    timestamp: number;
	    date: string;
	    time: string;
	    summary: string;
	    details: string;
	    appName: string;
	
	    static createFrom(source: any = {}) {
	        return new SearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.id = source["id"];
	        this.timestamp = source["timestamp"];
	        this.date = source["date"];
	        this.time = source["time"];
	        this.summary = source["summary"];
	        this.details = source["details"];
	        this.appName = source["appName"];
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
	export class SessionSummaryWithPosition {
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
	    hourOffset: number;
	    minuteOffset: number;
	    pixelPosition: number;
	    pixelHeight: number;
	    category: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionSummaryWithPosition(source);
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
	        this.hourOffset = source["hourOffset"];
	        this.minuteOffset = source["minuteOffset"];
	        this.pixelPosition = source["pixelPosition"];
	        this.pixelHeight = source["pixelHeight"];
	        this.category = source["category"];
	    }
	}
	
	export class ShellEventDisplay {
	    id: number;
	    timestamp: number;
	    command: string;
	    shellType: string;
	    workingDirectory: string;
	    exitCode: number;
	    durationSeconds: number;
	    hourOffset: number;
	    minuteOffset: number;
	    pixelPosition: number;
	
	    static createFrom(source: any = {}) {
	        return new ShellEventDisplay(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.timestamp = source["timestamp"];
	        this.command = source["command"];
	        this.shellType = source["shellType"];
	        this.workingDirectory = source["workingDirectory"];
	        this.exitCode = source["exitCode"];
	        this.durationSeconds = source["durationSeconds"];
	        this.hourOffset = source["hourOffset"];
	        this.minuteOffset = source["minuteOffset"];
	        this.pixelPosition = source["pixelPosition"];
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
	
	export class TopApp {
	    appName: string;
	    duration: number;
	    category: string;
	
	    static createFrom(source: any = {}) {
	        return new TopApp(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appName = source["appName"];
	        this.duration = source["duration"];
	        this.category = source["category"];
	    }
	}
	export class TimelineGridData {
	    date: string;
	    dayStats?: DayStats;
	    topApps: TopApp[];
	    hourlyGrid: Record<number, any>;
	    sessionSummaries: SessionSummaryWithPosition[];
	    categories: Record<string, string>;
	    gitEvents: Record<number, Array<GitEventDisplay>>;
	    shellEvents: Record<number, Array<ShellEventDisplay>>;
	    fileEvents: Record<number, Array<FileEventDisplay>>;
	    browserEvents: Record<number, Array<BrowserEventDisplay>>;
	    activityClusters: Record<number, Array<ActivityCluster>>;
	    afkBlocks: Record<number, Array<AFKBlock>>;
	
	    static createFrom(source: any = {}) {
	        return new TimelineGridData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.dayStats = this.convertValues(source["dayStats"], DayStats);
	        this.topApps = this.convertValues(source["topApps"], TopApp);
	        this.hourlyGrid = source["hourlyGrid"];
	        this.sessionSummaries = this.convertValues(source["sessionSummaries"], SessionSummaryWithPosition);
	        this.categories = source["categories"];
	        this.gitEvents = this.convertValues(source["gitEvents"], Array<GitEventDisplay>, true);
	        this.shellEvents = this.convertValues(source["shellEvents"], Array<ShellEventDisplay>, true);
	        this.fileEvents = this.convertValues(source["fileEvents"], Array<FileEventDisplay>, true);
	        this.browserEvents = this.convertValues(source["browserEvents"], Array<BrowserEventDisplay>, true);
	        this.activityClusters = this.convertValues(source["activityClusters"], Array<ActivityCluster>, true);
	        this.afkBlocks = this.convertValues(source["afkBlocks"], Array<AFKBlock>, true);
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
	
	
	
	export class UpdateInfo {
	    version: string;
	    releaseNotes: string;
	    downloadUrl: string;
	    publishedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.releaseNotes = source["releaseNotes"];
	        this.downloadUrl = source["downloadUrl"];
	        this.publishedAt = source["publishedAt"];
	    }
	}
	export class UpdateStatus {
	    currentVersion: string;
	    updatePending: boolean;
	    pendingInfo?: UpdateInfo;
	    lastCheck: string;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentVersion = source["currentVersion"];
	        this.updatePending = source["updatePending"];
	        this.pendingInfo = this.convertValues(source["pendingInfo"], UpdateInfo);
	        this.lastCheck = source["lastCheck"];
	        this.enabled = source["enabled"];
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
	
	export class WeekTimeBlock {
	    blockIndex: number;
	    startHour: number;
	    startMinute: number;
	    hasActivity: boolean;
	    dominantCategory: string;
	    activeSeconds: number;
	    intensity: number;
	
	    static createFrom(source: any = {}) {
	        return new WeekTimeBlock(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.blockIndex = source["blockIndex"];
	        this.startHour = source["startHour"];
	        this.startMinute = source["startMinute"];
	        this.hasActivity = source["hasActivity"];
	        this.dominantCategory = source["dominantCategory"];
	        this.activeSeconds = source["activeSeconds"];
	        this.intensity = source["intensity"];
	    }
	}
	export class WeekDayData {
	    date: string;
	    dayOfWeek: number;
	    dayName: string;
	    isToday: boolean;
	    totalHours: number;
	    timeBlocks: WeekTimeBlock[];
	    hasAiSummary: boolean;
	    screenshotCount: number;
	    categoryBreakdown: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new WeekDayData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.dayOfWeek = source["dayOfWeek"];
	        this.dayName = source["dayName"];
	        this.isToday = source["isToday"];
	        this.totalHours = source["totalHours"];
	        this.timeBlocks = this.convertValues(source["timeBlocks"], WeekTimeBlock);
	        this.hasAiSummary = source["hasAiSummary"];
	        this.screenshotCount = source["screenshotCount"];
	        this.categoryBreakdown = source["categoryBreakdown"];
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
	
	export class WeekSummaryStats {
	    totalHours: number;
	    averageDaily: number;
	    mostActiveDay: string;
	    categoryBreakdown: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new WeekSummaryStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalHours = source["totalHours"];
	        this.averageDaily = source["averageDaily"];
	        this.mostActiveDay = source["mostActiveDay"];
	        this.categoryBreakdown = source["categoryBreakdown"];
	    }
	}
	
	export class WeekTimelineData {
	    startDate: string;
	    endDate: string;
	    days: WeekDayData[];
	    weekStats?: WeekSummaryStats;
	
	    static createFrom(source: any = {}) {
	        return new WeekTimelineData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.startDate = source["startDate"];
	        this.endDate = source["endDate"];
	        this.days = this.convertValues(source["days"], WeekDayData);
	        this.weekStats = this.convertValues(source["weekStats"], WeekSummaryStats);
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
	export class YearlyStats {
	    year: number;
	    startDate: string;
	    endDate: string;
	    monthlyStats: MonthStats[];
	    totalActive: number;
	    activeMonths: number;
	    averages?: MonthStats;
	
	    static createFrom(source: any = {}) {
	        return new YearlyStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.year = source["year"];
	        this.startDate = source["startDate"];
	        this.endDate = source["endDate"];
	        this.monthlyStats = this.convertValues(source["monthlyStats"], MonthStats);
	        this.totalActive = source["totalActive"];
	        this.activeMonths = source["activeMonths"];
	        this.averages = this.convertValues(source["averages"], MonthStats);
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
	
	export class AppCategoryRecord {
	    id: number;
	    appName: string;
	    category: string;
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new AppCategoryRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.appName = source["appName"];
	        this.category = source["category"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class AssignmentContext {
	    appName?: string;
	    windowTitle?: string;
	    url?: string;
	    gitRepo?: string;
	    filePath?: string;
	    branchName?: string;
	    domain?: string;
	
	    static createFrom(source: any = {}) {
	        return new AssignmentContext(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appName = source["appName"];
	        this.windowTitle = source["windowTitle"];
	        this.url = source["url"];
	        this.gitRepo = source["gitRepo"];
	        this.filePath = source["filePath"];
	        this.branchName = source["branchName"];
	        this.domain = source["domain"];
	    }
	}
	export class AssignmentMetrics {
	    periodStart: number;
	    periodEnd: number;
	    totalActivities: number;
	    autoAssigned: number;
	    userAssigned: number;
	    corrections: number;
	    accuracyRate: number;
	
	    static createFrom(source: any = {}) {
	        return new AssignmentMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.periodStart = source["periodStart"];
	        this.periodEnd = source["periodEnd"];
	        this.totalActivities = source["totalActivities"];
	        this.autoAssigned = source["autoAssigned"];
	        this.userAssigned = source["userAssigned"];
	        this.corrections = source["corrections"];
	        this.accuracyRate = source["accuracyRate"];
	    }
	}
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
	export class CategorizationRule {
	    id: number;
	    appName: string;
	    category: string;
	    isSystemDefault: boolean;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new CategorizationRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.appName = source["appName"];
	        this.category = source["category"];
	        this.isSystemDefault = source["isSystemDefault"];
	        this.createdAt = source["createdAt"];
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
	    projectId: sql.NullInt64;
	    projectConfidence: sql.NullFloat64;
	    projectSource: sql.NullString;
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
	        this.projectId = this.convertValues(source["projectId"], sql.NullInt64);
	        this.projectConfidence = this.convertValues(source["projectConfidence"], sql.NullFloat64);
	        this.projectSource = this.convertValues(source["projectSource"], sql.NullString);
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
	export class HierarchicalSummary {
	    id: number;
	    periodType: string;
	    periodDate: string;
	    summary: string;
	    userEdited: boolean;
	    generatedAt: number;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new HierarchicalSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.periodType = source["periodType"];
	        this.periodDate = source["periodDate"];
	        this.summary = source["summary"];
	        this.userEdited = source["userEdited"];
	        this.generatedAt = source["generatedAt"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class Project {
	    id: number;
	    name: string;
	    color: string;
	    description?: string;
	    detectionPatterns: string;
	    isManual: boolean;
	    createdAt: number;
	    updatedAt?: number;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.color = source["color"];
	        this.description = source["description"];
	        this.detectionPatterns = source["detectionPatterns"];
	        this.isManual = source["isManual"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class ProjectActivity {
	    eventType: string;
	    eventId: number;
	    appName: string;
	    windowTitle: string;
	    startTime: number;
	    durationSeconds: number;
	    confidence: number;
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new ProjectActivity(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.eventType = source["eventType"];
	        this.eventId = source["eventId"];
	        this.appName = source["appName"];
	        this.windowTitle = source["windowTitle"];
	        this.startTime = source["startTime"];
	        this.durationSeconds = source["durationSeconds"];
	        this.confidence = source["confidence"];
	        this.source = source["source"];
	    }
	}
	export class ProjectBreakdown {
	    name: string;
	    timeMinutes: number;
	    activities: string[];
	    confidence: string;
	
	    static createFrom(source: any = {}) {
	        return new ProjectBreakdown(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.timeMinutes = source["timeMinutes"];
	        this.activities = source["activities"];
	        this.confidence = source["confidence"];
	    }
	}
	export class ProjectPattern {
	    id: number;
	    projectId: number;
	    patternType: string;
	    patternValue: string;
	    matchType: string;
	    weight: number;
	    hitCount: number;
	    lastUsedAt?: number;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new ProjectPattern(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.projectId = source["projectId"];
	        this.patternType = source["patternType"];
	        this.patternValue = source["patternValue"];
	        this.matchType = source["matchType"];
	        this.weight = source["weight"];
	        this.hitCount = source["hitCount"];
	        this.lastUsedAt = source["lastUsedAt"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ProjectStats {
	    screenshotCount: number;
	    focusEventCount: number;
	    gitCommitCount: number;
	    totalMinutes: number;
	    patternCount: number;
	
	    static createFrom(source: any = {}) {
	        return new ProjectStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.screenshotCount = source["screenshotCount"];
	        this.focusEventCount = source["focusEventCount"];
	        this.gitCommitCount = source["gitCommitCount"];
	        this.totalMinutes = source["totalMinutes"];
	        this.patternCount = source["patternCount"];
	    }
	}
	export class Screenshot {
	    id: number;
	    timestamp: number;
	    filepath: string;
	    dhash: string;
	    windowTitle: sql.NullString;
	    appName: sql.NullString;
	    windowClass: sql.NullString;
	    processPid: sql.NullInt64;
	    windowX: sql.NullInt64;
	    windowY: sql.NullInt64;
	    windowWidth: sql.NullInt64;
	    windowHeight: sql.NullInt64;
	    monitorName: sql.NullString;
	    monitorWidth: sql.NullInt64;
	    monitorHeight: sql.NullInt64;
	    sessionId: sql.NullInt64;
	    projectId: sql.NullInt64;
	    projectConfidence: sql.NullFloat64;
	    projectSource: sql.NullString;
	    memoryStatus: string;
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
	        this.windowClass = this.convertValues(source["windowClass"], sql.NullString);
	        this.processPid = this.convertValues(source["processPid"], sql.NullInt64);
	        this.windowX = this.convertValues(source["windowX"], sql.NullInt64);
	        this.windowY = this.convertValues(source["windowY"], sql.NullInt64);
	        this.windowWidth = this.convertValues(source["windowWidth"], sql.NullInt64);
	        this.windowHeight = this.convertValues(source["windowHeight"], sql.NullInt64);
	        this.monitorName = this.convertValues(source["monitorName"], sql.NullString);
	        this.monitorWidth = this.convertValues(source["monitorWidth"], sql.NullInt64);
	        this.monitorHeight = this.convertValues(source["monitorHeight"], sql.NullInt64);
	        this.sessionId = this.convertValues(source["sessionId"], sql.NullInt64);
	        this.projectId = this.convertValues(source["projectId"], sql.NullInt64);
	        this.projectConfidence = this.convertValues(source["projectConfidence"], sql.NullFloat64);
	        this.projectSource = this.convertValues(source["projectSource"], sql.NullString);
	        this.memoryStatus = source["memoryStatus"];
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
	    projectId: sql.NullInt64;
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
	        this.projectId = this.convertValues(source["projectId"], sql.NullInt64);
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
	    projects: ProjectBreakdown[];
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
	        this.projects = this.convertValues(source["projects"], ProjectBreakdown);
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
	export class TagUsageInfo {
	    tag: string;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new TagUsageInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tag = source["tag"];
	        this.count = source["count"];
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
	    projectId: sql.NullInt64;
	    projectConfidence: sql.NullFloat64;
	    projectSource: sql.NullString;
	    memoryStatus: string;
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
	        this.projectId = this.convertValues(source["projectId"], sql.NullInt64);
	        this.projectConfidence = this.convertValues(source["projectConfidence"], sql.NullFloat64);
	        this.projectSource = this.convertValues(source["projectSource"], sql.NullString);
	        this.memoryStatus = source["memoryStatus"];
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

export namespace tracker {
	
	export class MonitorInfo {
	    index: number;
	    name: string;
	    width: number;
	    height: number;
	    x: number;
	    y: number;
	    isPrimary: boolean;
	
	    static createFrom(source: any = {}) {
	        return new MonitorInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.name = source["name"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.isPrimary = source["isPrimary"];
	    }
	}

}

