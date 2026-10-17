import { useEffect, useRef, useState } from 'react'

type Section = 'Overview' | 'Text to speech' | 'Audio settings'
type Department = 'Police' | 'Sheriff' | 'Fire / EMS' | 'DOT'
type PhrasePreset = { id: string; label: string; text: string }
type AudioOutputChooser = MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> }
type RoutableAudio = HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> }

const DEFAULT_PRESETS: Record<Department, PhrasePreset[]> = {
  Police: [
    { id: 'police-traffic', label: 'Traffic stop', text: 'Dispatch, show me out on a traffic stop.' },
    { id: 'police-available', label: '10-8 · Available', text: 'Dispatch, show me 10-8 and available for calls.' },
    { id: 'police-responding', label: 'Responding', text: 'Dispatch, I am responding code 2.' },
    { id: 'police-scene', label: 'On scene', text: 'Dispatch, show me on scene.' },
    { id: 'police-need-unit', label: 'Request backup', text: 'Dispatch, send me another unit for backup.' },
    { id: 'police-clear', label: 'Clear call', text: 'Dispatch, I am clear from the call and back in service.' },
  ],
  Sheriff: [
    { id: 'sheriff-traffic', label: 'Traffic stop', text: 'Sheriff dispatch, I am out on a traffic stop.' },
    { id: 'sheriff-available', label: 'Available', text: 'Sheriff dispatch, I am available for calls.' },
    { id: 'sheriff-responding', label: 'Responding', text: 'Sheriff dispatch, responding to the call.' },
    { id: 'sheriff-scene', label: 'On scene', text: 'Sheriff dispatch, I am on scene.' },
    { id: 'sheriff-backup', label: 'Request backup', text: 'Sheriff dispatch, I need another deputy for backup.' },
    { id: 'sheriff-clear', label: 'Clear call', text: 'Sheriff dispatch, call is clear. I am back in service.' },
  ],
  'Fire / EMS': [
    { id: 'fire-responding', label: 'Responding', text: 'Fire dispatch, responding to the call.' },
    { id: 'fire-scene', label: 'On scene', text: 'Fire dispatch, we are on scene.' },
    { id: 'fire-transport', label: 'Transporting', text: 'Fire dispatch, transporting one patient to the hospital.' },
    { id: 'fire-clear', label: 'Available', text: 'Fire dispatch, we are clear and available.' },
    { id: 'fire-needs-unit', label: 'Request unit', text: 'Fire dispatch, please send an additional unit.' },
    { id: 'fire-hazard', label: 'Hazard report', text: 'Fire dispatch, we have a hazard at this location.' },
  ],
  DOT: [
    { id: 'dot-responding', label: 'Responding', text: 'DOT dispatch, responding to the reported road hazard.' },
    { id: 'dot-scene', label: 'On scene', text: 'DOT dispatch, I am on scene.' },
    { id: 'dot-lane', label: 'Lane closure', text: 'DOT dispatch, one lane is closed. Please use caution.' },
    { id: 'dot-clear', label: 'Road clear', text: 'DOT dispatch, the roadway is clear and open.' },
    { id: 'dot-assist', label: 'Request assistance', text: 'DOT dispatch, I need an additional unit for traffic control.' },
    { id: 'dot-available', label: 'Available', text: 'DOT dispatch, I am clear and available.' },
  ],
}

const CUSTOM_PRESETS_KEY = 'atlas-desktop-custom-radio-presets-v1'

function Mark() {
  return <span className="brand-mark" aria-hidden="true"><span /></span>
}

function App() {
  const [section, setSection] = useState<Section>('Overview')
  const [text, setText] = useState('')
  const [department, setDepartment] = useState<Department>('Police')
  const [customPresets, setCustomPresets] = useState<PhrasePreset[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) || '[]')
      return Array.isArray(saved) ? saved.filter((preset): preset is PhrasePreset =>
        typeof preset?.id === 'string' && typeof preset?.label === 'string' && typeof preset?.text === 'string'
      ).slice(0, 24) : []
    } catch { return [] }
  })
  const [callsign, setCallsign] = useState('')
  const [includeCallsign, setIncludeCallsign] = useState(false)
  const [sayOver, setSayOver] = useState(false)
  const [presetLabel, setPresetLabel] = useState('')
  const [outputDevice, setOutputDevice] = useState<MediaDeviceInfo | null>(null)
  const [outputConnected, setOutputConnected] = useState(false)
  const [voices, setVoices] = useState<string[]>([])
  const [voice, setVoice] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [speechStatus, setSpeechStatus] = useState('Choose the virtual cable as Atlas output and Discord input.')
  const holdActive = useRef(false)
  const pushSession = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  useEffect(() => {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(customPresets))
  }, [customPresets])

  useEffect(() => {
    let mounted = true
    window.atlasDesktop.listVoices().then(installed => {
      if (!mounted) return
      setVoices(installed)
      setVoice(installed[0] || '')
    }).catch(error => {
      if (mounted) setSpeechStatus(error instanceof Error ? error.message : 'Could not load Windows voices.')
    })

    const refreshOutputs = async () => {
      const selected = outputDevice
      if (!selected) return
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const current = devices.find(device => device.kind === 'audiooutput' && device.deviceId === selected.deviceId)
        if (current) {
          setOutputDevice(current)
          setOutputConnected(true)
          setSpeechStatus(`Output connected: ${current.label || 'selected device'}.`)
        } else {
          holdActive.current = false
          pushSession.current += 1
          audioRef.current?.pause()
          setSpeaking(false)
          setOutputConnected(false)
          setSpeechStatus('Audio output disconnected. Reconnect it, then choose the output again.')
        }
      } catch {
        setOutputConnected(false)
        setSpeechStatus('Could not check audio output. Choose the output again to reconnect.')
      }
    }
    navigator.mediaDevices.addEventListener('devicechange', refreshOutputs)
    window.addEventListener('blur', endPushToTalk)
    const cancelOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') endPushToTalk() }
    window.addEventListener('keydown', cancelOnEscape)
    return () => {
      mounted = false
      navigator.mediaDevices.removeEventListener('devicechange', refreshOutputs)
      window.removeEventListener('blur', endPushToTalk)
      window.removeEventListener('keydown', cancelOnEscape)
      holdActive.current = false
      pushSession.current += 1
      audioRef.current?.pause()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [outputDevice])

  async function chooseOutput() {
    const chooser = navigator.mediaDevices as AudioOutputChooser
    if (!chooser.selectAudioOutput) {
      setSpeechStatus('This Windows audio picker is not available. Update Atlas or choose the output device in Windows sound settings.')
      return
    }
    try {
      const device = await chooser.selectAudioOutput()
      setOutputDevice(device)
      setOutputConnected(true)
      setSpeechStatus(device.label.toLowerCase().includes('cable input')
        ? 'Virtual cable selected. Select CABLE Output as your microphone in Discord.'
        : 'Output selected. Choose CABLE Input to route Atlas speech into Discord.')
    } catch {
      setSpeechStatus('No output device selected.')
    }
  }

  async function beginPushToTalk() {
    if (!text.trim() || !outputDevice || !outputConnected || !voice || holdActive.current) return
    holdActive.current = true
    const session = ++pushSession.current
    setSpeaking(true)
    setSpeechStatus(`Preparing ${voice}… Keep holding to speak.`)
    try {
      const radioStart = includeCallsign && callsign.trim() ? `${callsign.trim()}, ` : ''
      const radioEnd = sayOver ? ' Over.' : ''
      const radioText = `${radioStart}${text.trim().slice(0, Math.max(0, 500 - radioStart.length - radioEnd.length))}${radioEnd}`
      const base64 = await window.atlasDesktop.synthesizeSpeech(radioText, voice)
      if (!holdActive.current || session !== pushSession.current) {
        setSpeechStatus('Push-to-talk released. Ready when you are.')
        setSpeaking(false)
        return
      }
      const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0))
      const source = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
      audioUrlRef.current = source
      const audio = new Audio(source) as RoutableAudio
      audioRef.current = audio
      if (!audio.setSinkId) throw new Error('This version of Windows does not support choosing an audio output device.')
      await audio.setSinkId(outputDevice.deviceId)
      audio.addEventListener('ended', () => {
        holdActive.current = false
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
        audioRef.current = null
        setSpeechStatus('Message finished. Hold to speak again.')
        setSpeaking(false)
      }, { once: true })
      audio.addEventListener('error', () => {
        holdActive.current = false
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
        audioRef.current = null
        setSpeechStatus('Audio playback failed. Check or reconnect the selected output device.')
        setSpeaking(false)
      }, { once: true })
      await audio.play()
      setSpeechStatus(`Speaking through ${outputDevice.label || 'selected output'}… Release to stop.`)
    } catch (error) {
      if (session !== pushSession.current) return
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
      audioRef.current = null
      holdActive.current = false
      setSpeechStatus(error instanceof Error ? error.message : 'Could not create speech.')
      setSpeaking(false)
    }
  }

  function endPushToTalk() {
    if (!holdActive.current) return
    holdActive.current = false
    pushSession.current += 1
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      audioRef.current = null
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = null
    setSpeaking(false)
    setSpeechStatus('Push-to-talk released. Ready when you are.')
  }

  function addCustomPreset() {
    const label = presetLabel.trim()
    const phrase = text.trim()
    if (!label || !phrase || customPresets.length >= 24) return
    setCustomPresets(current => [...current, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label, text: phrase }])
    setPresetLabel('')
    setSpeechStatus(`Saved “${label}” to your local radio presets.`)
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
        <header className="topline"><div className="breadcrumb"><span>Atlas Studio</span><b>/</b><strong>{section}</strong></div><div className="topline-right"><span className="preview-pill"><i /> PHASE 4 ER:LC CONTROLS</span><button className="help-button" title="Help">?</button></div></header>
        <div className="page-scroll">
          <section className="welcome"><div><p className="overline">VOICE, ON YOUR TERMS</p><h1>{section === 'Overview' ? <>Your words.<br /><em>On air.</em></> : section}</h1><p className="welcome-copy">Atlas turns your text into speech and routes it through your microphone in the Discord app you already use.</p></div><div className="sound-art" aria-hidden="true"><div className="sound-ring ring-one" /><div className="sound-ring ring-two" /><div className="sound-center"><Mark /></div><div className="sound-wave"><i /><i /><i /><i /><i /><i /><i /></div></div></section>

          <section className="connection-card"><div className="card-heading"><div><p className="overline">AUDIO ROUTE</p><h2>Use Atlas with your Discord account</h2></div><span className={`status-chip ${outputConnected ? 'is-ready' : ''}`}><i /> {outputConnected ? 'OUTPUT CONNECTED' : outputDevice ? 'OUTPUT DISCONNECTED' : 'OUTPUT NOT SET'}</span></div><div className="connection-row"><div className="discord-mark">♫</div><div className="server-copy"><strong>{outputDevice?.label || 'Choose an audio output'}</strong><small>Atlas output: VB-CABLE “CABLE Input” · Discord microphone: “CABLE Output”</small></div><button className="outline-button" onClick={chooseOutput}>Choose / reconnect <span>⌄</span></button></div><p className="hint"><span>i</span> Install VB-Audio Virtual Cable separately. Atlas does not include or install third-party audio drivers.</p><p className="route-status" role="status">{speechStatus}</p></section>

          <section className="radio-card">
            <div className="card-heading"><div><p className="overline">ER:LC RADIO DESK</p><h2>Department quick phrases</h2></div><span className="character-count">Tap a phrase to load it</span></div>
            <div className="department-tabs" role="tablist" aria-label="Department presets">{(Object.keys(DEFAULT_PRESETS) as Department[]).map(item => <button key={item} role="tab" aria-selected={department === item} className={department === item ? 'selected' : ''} onClick={() => setDepartment(item)}>{item}</button>)}</div>
            <div className="preset-grid">{[...DEFAULT_PRESETS[department], ...customPresets].map(preset => <div className="preset-item" key={preset.id}><button className="preset-button" title={preset.text} onClick={() => { setText(preset.text.slice(0, 500)); setSpeechStatus(`Loaded “${preset.label}”. Hold to speak when ready.`) }}><strong>{preset.label}</strong><span>{preset.text}</span></button>{customPresets.some(item => item.id === preset.id) && <button className="preset-remove" aria-label={`Delete ${preset.label}`} title="Delete custom preset" onClick={() => setCustomPresets(current => current.filter(item => item.id !== preset.id))}>×</button>}</div>)}</div>
            <div className="radio-tools"><label className="call-sign-field"><span>UNIT / CALLSIGN</span><input value={callsign} onChange={event => setCallsign(event.target.value.slice(0, 40))} placeholder="e.g. Unit 421" maxLength={40} /></label><label className="radio-check"><input type="checkbox" checked={includeCallsign} onChange={event => setIncludeCallsign(event.target.checked)} /> Read callsign</label><label className="radio-check"><input type="checkbox" checked={sayOver} onChange={event => setSayOver(event.target.checked)} /> End with “over”</label></div>
          </section>

          <section className="composer-card"><div className="card-heading"><div><p className="overline">QUICK SPEECH</p><h2>Push to talk</h2></div><span className="character-count">{text.length} / 500</span></div><textarea value={text} onChange={event => setText(event.target.value.slice(0, 500))} placeholder="Type a message or choose a department phrase…" maxLength={500} /><div className="composer-footer"><label className="voice-select"><span className="voice-icon">♫</span><span><small>INSTALLED VOICE</small><select aria-label="Speech voice" value={voice} onChange={event => setVoice(event.target.value)} disabled={!voices.length}>{voices.length ? voices.map(item => <option key={item} value={item}>{item}</option>) : <option>Loading voices…</option>}</select></span></label><button className={`speak-button push-button ${speaking ? 'is-speaking' : ''}`} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); void beginPushToTalk() }} onPointerUp={endPushToTalk} onPointerCancel={endPushToTalk} onLostPointerCapture={endPushToTalk} onKeyDown={event => { if (event.code === 'Space' && !event.repeat) { event.preventDefault(); void beginPushToTalk() } }} onKeyUp={event => { if (event.code === 'Space') { event.preventDefault(); endPushToTalk() } }} disabled={!text.trim() || !outputConnected || !voice}><span>{speaking ? '●' : '◉'}</span> {speaking ? 'Speaking · release to stop' : 'Hold to speak'}</button><button className="clear-button" onClick={() => setText('')} disabled={!text}>Clear</button></div><p className="phase-note">Choose a Windows voice, then hold the button (or Space while focused). Releasing stops playback.</p>
            <div className="save-preset"><input value={presetLabel} onChange={event => setPresetLabel(event.target.value.slice(0, 32))} maxLength={32} placeholder="Name this phrase" aria-label="Preset name" /><button className="outline-button" onClick={addCustomPreset} disabled={!presetLabel.trim() || !text.trim() || customPresets.length >= 24}>Save as preset</button><span>{customPresets.length}/24 custom phrases saved on this device</span></div>
          </section>

          <footer className="status-footer"><span><i className="connection-dot" /> All systems local</span><span>Atlas Desktop <b>·</b> 0.1.0</span></footer>
        </div>
      </main>
    </div>
  )
}

export default App
