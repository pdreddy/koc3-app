import React from 'react';

// Reusable white, rounded, soft-shadow card. Optional `title` renders a
// consistent heading. Extra className and props (e.g. data-testid) pass through.
//
// Usage: <Card title="Match teams"> ... </Card>

export default function Card({ title, className = '', children, ...rest }) {
  const classes = ['card', className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}
