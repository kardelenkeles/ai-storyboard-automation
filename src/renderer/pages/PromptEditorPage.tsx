import React, { useEffect, useState } from 'react'
import type { StorySceneDto } from '../../shared/ipc/contracts'

const PROJECT_ID = 'default-project'

export default function PromptEditorPage(props: { sceneId: string | null; onDone: () => void }): JSX.Element {
  const [title, setTitle] = useState('Untitled Scene')
  const [prompt, setPrompt] = useState('Describe the shot...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async (): Promise<void> => {
      if (!props.sceneId) return
      const api = (window as any).studioApi
      if (!api) {
        setError('Desktop bridge is not available. Start the app with Electron.')
        return
      }

      try {
        const board = await api.getStoryboard(PROJECT_ID)
        const scene = board.scenes.find((x: StorySceneDto) => x.id === props.sceneId)
        if (scene) {
          setTitle(scene.title)
          setPrompt(scene.prompt)
          setError(null)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load scene')
      }
    }

    void load()
  }, [props.sceneId])

  const save = async (): Promise<void> => {
    if (!props.sceneId) return
    const api = (window as any).studioApi
    if (!api) {
      setError('Desktop bridge is not available. Start the app with Electron.')
      return
    }

    try {
      await api.updatePrompt(PROJECT_ID, { sceneId: props.sceneId, prompt })
      setError(null)
      props.onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save prompt')
    }
  }

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

      {error && <p style={{ color: '#fca5a5', marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        <label>
          <div style={{ color: 'var(--muted)', marginBottom: 6 }}>Prompt text</div>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ width: '100%', minHeight: 140, padding: 12, borderRadius: 8 }} />
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="ghost-button" onClick={() => void save()}>Save</button>
        </div>
      </div>
    </article>
  )
}
