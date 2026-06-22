import React from 'react';

// Reusable button that renders the shared `.btn` styling so every screen gets
// the same blue-with-white-text look and 44px tap target.
//
// Usage: <Button variant="success" size="small" full onClick={...}>Save</Button>
// All other props (data-testid, type, disabled, aria-*) are forwarded.

const VARIANT_CLASS = {
  primary: '',
  success: 'success',
  danger: 'danger',
  warn: 'warn',
  ghost: 'ghost',
  secondary: 'secondary'
};

export default function Button({
  variant = 'primary',
  size,
  full = false,
  className = '',
  children,
  ...rest
}) {
  const classes = [
    'btn',
    VARIANT_CLASS[variant] || '',
    size === 'small' ? 'small' : '',
    full ? 'full' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
