import React from 'react';

// Standard page shell: the centered container plus the consistent page-title
// header used across every screen. Keeps spacing and the white/blue theme
// identical from page to page.
//
// Usage:
//   <PageLayout title="Standings" subtitle="Group stage">
//     ...cards/tables...
//   </PageLayout>

export default function PageLayout({ title, subtitle, actions, children, className = '', ...rest }) {
  const classes = ['container', className].filter(Boolean).join(' ');
  return (
    <main className={classes} {...rest}>
      {(title || subtitle || actions) && (
        <div className="page-title">
          {actions && <div className="page-title-actions">{actions}</div>}
          {title && <h1>{title}</h1>}
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}
      {children}
    </main>
  );
}
