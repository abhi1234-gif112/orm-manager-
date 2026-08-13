from app.ingestion.base import SourceConnector
from app.ingestion.sources.rss import RSSConnector
from app.ingestion.sources.web import WebConnector
from app.models.enums import IngestionMethod
from app.models.source import Source

_RSS_CONNECTOR = RSSConnector()
_WEB_CONNECTOR = WebConnector()


def get_connector(source: Source) -> SourceConnector:
    if source.ingestion_method == IngestionMethod.RSS_POLL:
        return _RSS_CONNECTOR
    if source.ingestion_method == IngestionMethod.WEB_SCRAPE:
        return _WEB_CONNECTOR
    raise NotImplementedError(
        f"No automated connector for ingestion_method={source.ingestion_method.value}"
    )
