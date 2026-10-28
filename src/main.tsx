import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './techno.css'
import './planner.css'
import './v04.css'
import './lists.css'
import './journal.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// The worker only caches public app files. User data remains in IndexedDB.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
    .catch(error => console.warn('BASE offline cache is unavailable:', error))
}
