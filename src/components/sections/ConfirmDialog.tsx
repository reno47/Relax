import { useEffect } from 'react'
import './confirmDialog.css'

interface ConfirmDialogProps {
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: Readonly<ConfirmDialogProps>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel, onConfirm])

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="confirm-title">{title}</h3>
        <div className="confirm-message">{message}</div>
        <div className="confirm-actions">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="confirm-danger" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
