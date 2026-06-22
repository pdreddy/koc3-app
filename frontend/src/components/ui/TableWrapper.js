import React from 'react';

// Wraps a table so it scrolls horizontally (with momentum on touch) instead of
// breaking the mobile layout. Mirrors the shared `.table-wrap` styling.
//
// Usage:
//   <TableWrapper>
//     <table className="std">...</table>
//   </TableWrapper>

export default function TableWrapper({ className = '', children, ...rest }) {
  const classes = ['table-wrap', className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
