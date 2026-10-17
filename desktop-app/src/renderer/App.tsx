import { useState } from 'react'

type Section = 'Overview' | 'Text to speech' | 'Audio settings'
type AudioOutputChooser = MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> }
type RoutableAudio = HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> }

function Mark() {
  return <span className="brand-mark" aria-hidden="true"><span /></span>
}

function App() {
  const [section, setSection] = useState<Section>('Overview')
  const [text, setText] = useState('')
  const [outputDevice, setOutputDevice] = useState<MediaDeviceInfo | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [speechStatus, setSpeechStatus] = useState('Choose the virtual cable as Atlas output and Discord input.')

  async function chooseOutput() {
    const chooser = navigator.mediaDevices as AudioOutputChooser
    if (!chooser.selectAudioOutput) {
      setSpeechStatus('This Windows audio picker is not available. Update Atlas or choose the output device in Windows sound settings.')
      return
    }
    try {
      const device = await chooser.selectAudioOutput()
      setOutputDevice(device)
      setSpeechStatus(device.label.toLowerCase().includes('cable input')
        ? 'Virtual cable selected. Select CABLE Output as your microphone in Discord.'
        : 'Output selected. Choose CABLE Input to route Atlas speech into Discord.')
    } catch {
      setSpeechStatus('No output device selected.')
    }
  }

  async function speak() {
    if (!text.trim() || !outputDevice || speaking) return
    setSpeaking(true)
    setSpeechStatus('Generating speech locally…')
    let source: string | null = null
    try {
      const base64 = await window.atlasDesktop.synthesizeSpeech(text.trim())
      const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0))
      source = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
      const audio = new Audio(source) as RoutableAudio
      if (!audio.setSinkId) throw new Error('This version of Windows does not support choosing an audio output device.')
      await audio.setSinkId(outputDevice.deviceId)
      audio.addEventListener('ended', () => {
        if (source) URL.revokeObjectURL(source)
        setSpeechStatus('Speech sent. Ready for another message.')
        setSpeaking(false)
      }, { once: true })
      audio.addEventListener('error', () => {
        if (source) URL.revokeObjectURL(source)
        setSpeechStatus('Audio playback failed. Check the selected output device.')
        setSpeaking(false)
      }, { once: true })
      await audio.play()
      setSpeechStatus('Speaking through ' + outputDevice.label + '.')
    } catch (error) {
      if (source) URL.revokeObjectURL(source)
      setSpeechStatus(error instanceof Error ? error.message : 'Could not create speech.')
      setSpeaking(false)
      return
    }
  }

  return (
    <div className="app-frame">
      <aside className="rail">
        <div className="brand"><Mark /><span>ATLAS</span></div>
        <div className="rail-divider" />
        <button className="server-orb selected" aria-label="Atlas home"><Mark /></button>
        <button className="server-orb add-server" aria-label="Add a Discord server">+</button>
        <div className="rail-bottom"><span className="connection-dot" /><span>LOCAL</span></div>
      </aside>

      <aside className="sidebar">
        <div className="workspace-title"><div><small>DESKTOP AUDIO</small><strong>Atlas Studio</strong></div><span className="tiny-caret">⌄</span></div>
        <div className="sidebar-label">YOUR STUDIO</div>
        {(['Overview', 'Text to speech', 'Audio settings'] as Section[]).map(item => (
          <button key={item} className={`nav-item ${section === item ? 'active' : ''}`} onClick={() => setSection(item)}>
            <span className="nav-glyph">{item === 'Overview' ? '◈' : item === 'Text to speech' ? '◖' : '⚙'}</span>{item}
          </button>
        ))}
        <div className="sidebar-spacer" />
        <div className="account-card"><div className="account-avatar">A</div><div><strong>Local profile</strong><small>Desktop preview</small></div><span className="tiny-caret">···</span></div>
      </aside>

      <main className="content">
        <header className="topline"><div className="breadcrumb"><span>Atlas Studio</span><b>/</b><strong>{section}</strong></div><div className="topline-right"><span className="preview-pill"><i /> PHASE 2 PROTOTYPE</span><button className="help-button" title="Help">?</button></div></header>
        <div className="page-scroll">
          <section className="welcome"><div><p className="overline">VOICE, ON YOUR TERMS</p><h1>{section === 'Overview' ? <>Your words.<br /><em>On air.</em></> : section}</h1><p className="welcome-copy">Atlas turns your text into speech and routes it through your microphone in the Discord app you already use.</p></div><div className="sound-art" aria-hidden="true"><div className="sound-ring ring-one" /><div className="sound-ring ring-two" /><div className="sound-center"><Mark /></div><div className="sound-wave"><i /><i /><i /><i /><i /><i /><i /></div></div></section>

          <section className="connection-card"><div className="card-heading"><div><p className="overline">AUDIO ROUTE</p><h2>Use Atlas with your Discord account</h2></div><span className={`status-chip ${outputDevice ? 'is-ready' : ''}`}><i /> {outputDevice ? 'OUTPUT SELECTED' : 'OUTPUT NOT SET'}</span></div><div className="connection-row"><div className="discord-mark">♫</div><div className="server-copy"><strong>{outputDevice?.label || 'Choose an audio output'}</strong><small>Atlas output: VB-CABLE “CABLE Input” · Discord microphone: “CABLE Output”</small></div><button className="outline-button" onClick={chooseOutput}>Choose output <span>⌄</span></button></div><p className="hint"><span>i</span> Install VB-Audio Virtual Cable separately. Atlas does not include or install third-party audio drivers.</p><p className="route-status" role="status">{speechStatus}</p></section>

          <section className="composer-card"><div className="card-heading"><div><p className="overline">QUICK SPEECH</p><h2>Send a message</h2></div><span className="character-count">{text.length} / 500</span></div><textarea value={text} onChange={event => setText(event.target.value.slice(0, 500))} placeholder="Type a message for Atlas to speak…" maxLength={500} /><div className="composer-footer"><div className="voice-select"><span className="voice-icon">♫</span><span><small>VOICE</small><strong>Windows default voice</strong></span><span className="tiny-caret">⌄</span></div><button className="speak-button" onClick={speak} disabled={!text.trim() || !outputDevice || speaking}><span>{speaking ? '◌' : '▶'}</span> {speaking ? 'Speaking…' : 'Speak through Discord'}</button></div><p className="phase-note">Uses the Windows speech voice installed on this computer.</p></section>

          <footer className="status-footer"><span><i className="connection-dot" /> All systems local</span><span>Atlas Desktop <b>·</b> 0.1.0</span></footer>
        </div>
      </main>
    </div>
  )
}

export default App
