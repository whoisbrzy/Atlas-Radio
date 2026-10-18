import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '../../../faulty-terminal.js'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles.css'
import './window.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
