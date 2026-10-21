'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import { getArticleDetail } from '@/lib/api';

export default function ArticleModal() {
  const { articleModal, closeArticleModal } = useStore();
  const { show, slug, article: initialArticle } = articleModal || {};

  const [article, setArticle] = useState(initialArticle || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show && slug) {
      setLoading(true);
      setError(null);
      getArticleDetail(slug)
        .then(res => {
          setArticle(res);
        })
        .catch(err => {
          if (initialArticle) {
            setArticle(initialArticle);
          } else {
            setError(err.message || 'Article could not be loaded.');
          }
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (show && initialArticle) {
      setArticle(initialArticle);
    }
  }, [show, slug, initialArticle]);

  if (!show) return null;

  const title = article?.title || 'Vedic Wisdom';
  const category = article?.category || 'Spiritual';
  const content = article?.content || article?.excerpt || '';
  const author = article?.author?.name || article?.author || 'Acharya Ji';
  const dateStr = article?.created_at ? new Date(article.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div
      className="pd-modal-overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) closeArticleModal();
      }}
      style={{ zIndex: 1050 }}
    >
      <div
        className="pd-modal"
        style={{
          maxWidth: '720px',
          display: 'block',
          padding: 'clamp(18px, 4vw, 36px)',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <button
          className="pd-close"
          onClick={closeArticleModal}
          aria-label="Close article"
        >
          ✕
        </button>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--gold-lt)' }}>
            Loading Vedic Teachings...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#f87171' }}>
            {error}
          </div>
        ) : (
          <article>
            <div style={{ marginBottom: '16px' }}>
              <span className="kicker" style={{ display: 'inline-block', marginBottom: '6px' }}>
                {category}
              </span>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(20px, 3.2vw, 26px)', color: 'var(--gold-lt)', lineHeight: '1.3' }}>
                {title}
              </h2>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--muted)', marginTop: '8px', flexWrap: 'wrap' }}>
                <span>✍️ {author}</span>
                {dateStr && <span>📅 {dateStr}</span>}
              </div>
            </div>

            <div
              style={{
                lineHeight: '1.8',
                fontSize: '15px',
                color: 'var(--cream)',
                borderTop: '1px solid rgba(224, 176, 74, 0.2)',
                paddingTop: '20px',
              }}
              dangerouslySetInnerHTML={{
                __html: content.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>'),
              }}
            />

            <div style={{
              marginTop: '30px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Have questions regarding this Vidhi?
              </span>
              <a
                href="https://wa.me/919000000000"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-gold"
                style={{ fontSize: '12px', padding: '8px 16px' }}
              >
                Ask Guruji on WhatsApp →
              </a>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
