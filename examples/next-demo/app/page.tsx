export default function HomePage() {
  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '64px 24px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>
        feedback-sdk demo
      </h1>
      <p style={{ color: '#57534e', fontSize: '1.1rem', marginBottom: '48px', lineHeight: 1.6 }}>
        Click the <strong>💬</strong> button in the bottom-right corner to submit feedback.
        Point at any element on this page to attach context to your report.
      </p>

      <section
        data-feedback-label="Feature cards section"
        style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
      >
        {[
          { title: 'MCP integration', body: 'List, read, and update feedback from Cursor, Claude Code, Windsurf, and Cline.' },
          { title: 'HTTP + webhooks', body: 'POST /feedback ingests items. Outbound webhooks fire on create and status change.' },
          { title: 'Element context', body: 'Point-and-click picks a DOM element. Its breadcrumb, type, and surrounding text are captured.' },
          { title: 'Human-in-the-loop', body: 'pipeline_state tracks each item from captured → triaged → plan_approved → shipped.' },
        ].map((card) => (
          <div
            key={card.title}
            data-feedback-label={card.title}
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              border: '1px solid #e7e5e4',
            }}
          >
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', marginTop: 0 }}>{card.title}</h2>
            <p style={{ color: '#78716c', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{card.body}</p>
          </div>
        ))}
      </section>

      <section style={{ marginTop: '48px', padding: '24px', background: '#fff', borderRadius: '12px', border: '1px solid #e7e5e4' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', marginTop: 0 }}>HITL pipeline states</h2>
        <ol style={{ paddingLeft: '20px', color: '#57534e', lineHeight: 2, margin: 0 }}>
          {['captured', 'triaged', 'plan_approved', 'in_progress', 'code_review', 'ship_approved', 'shipped', 'closed'].map((s) => (
            <li key={s}><code>{s}</code></li>
          ))}
        </ol>
      </section>
    </main>
  )
}
