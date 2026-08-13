import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    CONTRIBUTOR = "contributor"
    VIEWER = "viewer"


class SourceType(str, enum.Enum):
    RSS = "rss"
    ATOM = "atom"
    WEB = "web"
    YOUTUBE = "youtube"
    OFFICIAL_RELEASE = "official_release"
    PRESS_RELEASE = "press_release"


class IngestionMethod(str, enum.Enum):
    RSS_POLL = "rss_poll"
    WEB_SCRAPE = "web_scrape"
    API = "api"
    MANUAL = "manual"


class ArticleProcessingStatus(str, enum.Enum):
    DISCOVERED = "discovered"
    EXTRACTED = "extracted"
    SCOUTED = "scouted"
    CLUSTERED = "clustered"
    FAILED = "failed"


class VerificationStatus(str, enum.Enum):
    UNVERIFIED = "unverified"
    SINGLE_SOURCE = "single_source"
    MULTI_SOURCE = "multi_source"
    PRIMARY_SOURCE_BACKED = "primary_source_backed"
    VERIFIED = "verified"
    DISPUTED = "disputed"
    CORRECTED = "corrected"


class EditorialStatus(str, enum.Enum):
    INCOMING = "incoming"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ClusterMethod(str, enum.Enum):
    HASH = "hash"
    TITLE_SIMILARITY = "title_similarity"
    SEMANTIC = "semantic"
    ENTITY_OVERLAP = "entity_overlap"
    MANUAL = "manual"


class EntityType(str, enum.Enum):
    PERSON = "person"
    ORGANIZATION = "organization"
    LOCATION = "location"
    INSTITUTION = "institution"
    PARTY = "party"
    OTHER = "other"


class Platform(str, enum.Enum):
    INSTAGRAM = "instagram"
    WEBSITE = "website"
    X = "x"


class ContentLabel(str, enum.Enum):
    REPORTING = "reporting"
    ANALYSIS = "analysis"
    OPINION = "opinion"
    SPONSORED = "sponsored"
    POLITICAL_COMMUNICATION = "political_communication"


class ContentStatus(str, enum.Enum):
    DRAFT = "draft"
    REGENERATING = "regenerating"
    READY_FOR_REVIEW = "ready_for_review"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class DistributionAttemptStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    RETRYING = "retrying"


class EditorialAction(str, enum.Enum):
    VIEWED = "viewed"
    EDITED_TITLE = "edited_title"
    EDITED_SUMMARY = "edited_summary"
    MERGED = "merged"
    SPLIT = "split"
    VERIFICATION_SET = "verification_set"
    APPROVED = "approved"
    REJECTED = "rejected"
    CORRECTION_ISSUED = "correction_issued"


class AgentName(str, enum.Enum):
    SCOUT = "scout"
    ANALYST = "analyst"
    VERIFICATION = "verification"
    CONTENT = "content"
    ANALYTICS = "analytics"
    EDITORIAL_ASSISTANT = "editorial_assistant"


class AgentTrigger(str, enum.Enum):
    SCHEDULED = "scheduled"
    MANUAL = "manual"
    EVENT = "event"


class AgentRunStatus(str, enum.Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentTaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    WAITING_APPROVAL = "WAITING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ESCALATED = "ESCALATED"


class ApprovalDecision(str, enum.Enum):
    APPROVED = "approved"
    REJECTED = "rejected"


class AuditActorType(str, enum.Enum):
    USER = "user"
    AGENT = "agent"
    SYSTEM = "system"
