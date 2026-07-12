import { supabase } from './supabase'

// Client für die drive-bridge Edge Function. Session-Token wird von
// supabase.functions.invoke automatisch mitgeschickt (Auth + sm-Admin-Check
// passieren serverseitig).

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  webViewLink?: string
  size?: string
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'
export const isFolder = (f: DriveFile) => f.mimeType === FOLDER_MIME

interface BridgeResult {
  configured: boolean
  files?: DriveFile[]
  folder?: { id: string; name: string; webViewLink?: string }
  error?: string
  detail?: string
}

async function invoke(body: Record<string, unknown>): Promise<BridgeResult> {
  const { data, error } = await supabase.functions.invoke('drive-bridge', { body })
  if (error) {
    // Edge-Function-Fehler (z. B. 403 not_admin) kommen als FunctionsHttpError.
    let detail = error.message
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json()
        detail = j?.error ? `${j.error}${j.detail ? ': ' + j.detail : ''}` : detail
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return data as BridgeResult
}

/** Ordnerinhalt listen. `configured:false` → serverseitiger Drive-Zugang fehlt (Secrets). */
export async function driveList(folderId: string): Promise<BridgeResult> {
  return invoke({ action: 'list', folderId })
}

/** Unterordner anlegen. */
export async function driveCreateFolder(parentId: string, name: string): Promise<BridgeResult> {
  return invoke({ action: 'create_folder', parentId, name })
}
