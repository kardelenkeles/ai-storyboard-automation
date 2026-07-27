import React, { useEffect, useState } from 'react'

export default function PromptEditorPage(props: { sceneId: string | null; onDone: () => void }): JSX.Element {
  const [title, setTitle] = useState('Untitled Scene')
  const [prompt, setPrompt] = useState('Describe the shot...')

  useEffect(() => {
    if (props.sceneId) {
      // In a real app we'd load the scene by id via IPC. Use example content for now.
      setTitle(`Editing ${props.sceneId}`)
      setPrompt('A wide establishing shot of the city at dawn.')
    }
  }, [props.sceneId])

  return (
    <article className="panel" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div>
          <p className="panel-label">Prompt</p>
          <h3>{title}</h3>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ghost-button" onClick={props.onDone}>Done</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <label>
          <div style={{ color: 'var(--muted)', marginBottom: 6 }}>Prompt text</div>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ width: '100%', minHeight: 140, padding: 12, borderRadius: 8 }} />
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="ghost-button" onClick={() => { /* autosave placeholder */ }}>Autosave</button>
          <button className="ghost-button" onClick={() => { /* save placeholder */ props.onDone() }}>Save</button>
        </div>
      </div>
    </article>
  )
}
