import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.article import Article
from app.models.user import User
from app.schemas.article import ArticleRead

router = APIRouter(prefix="/articles", tags=["articles"])


@router.get("", response_model=list[ArticleRead])
def list_articles(
    source_id: uuid.UUID | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Article]:
    query = db.query(Article)
    if source_id:
        query = query.filter(Article.source_id == source_id)
    return query.order_by(Article.discovered_at.desc()).limit(min(limit, 200)).all()


@router.get("/{article_id}", response_model=ArticleRead)
def get_article(
    article_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Article:
    article = db.get(Article, article_id)
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article
