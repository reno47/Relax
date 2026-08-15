import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

const root = createRoot(document.getElementById('root')!)

if (!PUBLISHABLE_KEY) {
  root.render(
    <StrictMode>
      <div className="setup-notice">
        <h1>Setup needed</h1>
        <p>
          Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to your <code>.env</code> to enable sign-in.
        </p>
      </div>
    </StrictMode>,
  )
} else {
  root.render(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    </StrictMode>,
  )
}
