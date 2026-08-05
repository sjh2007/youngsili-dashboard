import { useId, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'call';
  size?: 'sm' | 'md' | 'lg';
};

export function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...props }: ButtonProps) {
  const variantClass = variant === 'danger' ? 'btn-danger' : variant === 'success' ? 'btn-success' : variant === 'call' ? 'btn-call' : `btn-${variant}`;
  return <button type={type} className={`${variantClass} ui-button ui-button--${size} ${size === 'lg' ? 'btn-lg' : size === 'sm' ? 'btn-xs' : ''} ${className}`.trim()} {...props} />;
}

type SectionProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export function Section({ title, description, actions, className = '', children, ...props }: SectionProps) {
  return (
    <section className={`section ui-section ${className}`.trim()} {...props}>
      {(title || description || actions) && (
        <div className="ui-section__header">
          <div className="ui-section__heading">
            {title && <h2 className="section-title ui-section__title">{title}</h2>}
            {description && <p className="ui-section__description">{description}</p>}
          </div>
          {actions && <div className="ui-section__actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

type PageIntroProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageIntro({ title, description, actions, className = '' }: PageIntroProps) {
  return (
    <div className={`page-intro ui-page-intro ${className}`.trim()}>
      <div className="ui-page-intro__copy">
        <h1 className="page-intro-title">{title}</h1>
        {description && <p className="page-intro-sub">{description}</p>}
      </div>
      {actions && <div className="ui-page-intro__actions">{actions}</div>}
    </div>
  );
}

type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
};

export function EmptyState({ title, description, actions, compact = false }: EmptyStateProps) {
  return (
    <div className={`empty-state ui-empty-state ${compact ? 'empty-state--sm' : ''}`} role="status">
      <div className="empty-title">{title}</div>
      {description && <div className="empty-desc">{description}</div>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
}

type StatusTone = 'danger' | 'warning' | 'normal' | 'neutral';

export function StatusBadge({ tone = 'neutral', children, className = '' }: { tone?: StatusTone; children: ReactNode; className?: string }) {
  return <span className={`status-badge ui-status-badge badge-${tone} ${className}`.trim()}>{children}</span>;
}

export function Toolbar({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return <div className={`ui-toolbar ${className}`.trim()} role="toolbar" aria-label={label}>{children}</div>;
}

type DialogProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  tone?: 'default' | 'danger';
  alert?: boolean;
  className?: string;
};

export function Dialog({ open, title, description, children, actions, onClose, tone = 'default', alert = false, className = '' }: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`modal ui-dialog ui-dialog--${tone} ${className}`.trim()} role={alert ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
        <div className="modal-title ui-dialog__title" id={titleId}>{title}</div>
        {description && <div className="modal-sub ui-dialog__description" id={descriptionId}>{description}</div>}
        {children && <div className="ui-dialog__body">{children}</div>}
        {actions && <div className="modal-btns ui-dialog__actions">{actions}</div>}
      </div>
    </div>
  );
}
