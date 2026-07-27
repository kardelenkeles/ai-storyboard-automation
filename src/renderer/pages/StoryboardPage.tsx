import React from 'react'

interface SceneCard {
  id: string
  title: string
  prompt: string
  status: 'Draft' | 'Ready' | 'Queued'
  reference: string
}

const storyboardPreview: SceneCard[] = [
  { id: 's1', title: 'Scene 01', prompt: 'An aerial sunrise reveal over a futuristic city skyline, cinematic and warm.', status: 'Ready', reference: 'No reference' },
  { id: 's2', title: 'Scene 02', prompt: 'A close-up of the lead character looking at a holographic map in a quiet alley.', status: 'Draft', reference: 'Uses Scene 01' },
  { id: 's3', title: 'Scene 03', prompt: 'The camera pulls back to reveal the full team preparing for launch.', status: 'Queued', reference: 'Uses Scene 02' },
]

export default function StoryboardPage(props: { onEditScene: (id: string) => void }): JSX.Element {
  return (
    <>
      <article className="panel storyboard-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-label">Storyboard</p>
            <h3>Scene queue</h3>
          </div>
          <button className="ghost-button" type="button">Add scene</button>
        </div>

        <div className="storyboard-grid">
          {storyboardPreview.map((scene) => (
            <article className="scene-card" key={scene.id}>
              <div className="scene-card__header">
                <span>{scene.title}</span>
                <span className={`status-pill status-pill--${scene.status.toLowerCase()}`}>{scene.status}</span>
              </div>
              <p className="scene-card__prompt">{scene.prompt}</p>
              <div className="scene-card__footer">
                <span>{scene.reference}</span>
                <button className="ghost-button" onClick={() => props.onEditScene(scene.id)}>Edit</button>
              </div>
            </article>
          ))}
        </div>
      </article>

      <article className="panel side-panel">
        <p className="panel-label">Workflow</p>
        <h3>Foundation checkpoints</h3>
        <ul className="checklist">
          <li>Electron shell and secure preload bridge</li>
          <li>Shared domain and IPC contracts</li>
          <li>Renderer shell with storyboard layout</li>
          <li>Build and packaging configuration</li>
        </ul>
      </article>
    </>
  )
}
