// Drag-and-drop uploader — files saved locally via POST /api/files/upload
// XHR used instead of fetch so upload progress is trackable
'use client'

import React, { useState, useRef, useCallback } from 'react'
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  Trash2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface UploadedFile {
  id?: string
  name: string
  url: string
  size: number
  type: string
}

interface InProgressFile {
  name: string
  progress: number
  error?: string
  done?: boolean
}

interface FileUploaderProps {
  contactId?: string
  companyId?: string
  onUploadComplete?: (file: UploadedFile) => void
  existingFiles?: UploadedFile[]
  onDeleteFile?: (id: string) => void
  className?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function uploadFileWithProgress(
  file: File,
  contactId: string | undefined,
  companyId: string | undefined,
  onProgress: (p: number) => void
): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)
    if (contactId) formData.append('contactId', contactId)
    if (companyId) formData.append('companyId', companyId)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as UploadedFile)
      } else {
        try {
          const body = JSON.parse(xhr.responseText)
          reject(new Error(body.error ?? 'Upload failed'))
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`))
        }
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error')))
    xhr.open('POST', '/api/files/upload')
    xhr.send(formData)
  })
}

export function FileUploader({
  contactId,
  companyId,
  onUploadComplete,
  existingFiles = [],
  onDeleteFile,
  className,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [queue, setQueue] = useState<InProgressFile[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return

      // Add each file to the queue, upload sequentially
      for (const file of files) {
        setQueue((prev) => [...prev, { name: file.name, progress: 0 }])

        try {
          const result = await uploadFileWithProgress(
            file,
            contactId,
            companyId,
            (p) => {
              setQueue((prev) =>
                prev.map((f) => (f.name === file.name && !f.done ? { ...f, progress: p } : f))
              )
            }
          )

          setQueue((prev) =>
            prev.map((f) => (f.name === file.name ? { ...f, progress: 100, done: true } : f))
          )
          onUploadComplete?.(result)
        } catch (err) {
          setQueue((prev) =>
            prev.map((f) =>
              f.name === file.name
                ? { ...f, error: (err as Error).message, done: true }
                : f
            )
          )
        }
      }

      // Clear completed after 2s
      setTimeout(() => setQueue((prev) => prev.filter((f) => !f.done || f.error)), 2000)
    },
    [contactId, companyId, onUploadComplete]
  )

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }

  const deleteFile = async (id: string) => {
    try {
      await fetch(`/api/files/${id}`, { method: 'DELETE' })
      onDeleteFile?.(id)
    } catch {}
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 transition-all',
          isDragging
            ? 'scale-[1.01] border-slate bg-slate/5'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <Upload size={18} className="text-gray-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            Drop files here or <span className="text-slate">browse</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-400">Any file type, no size limit</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) handleFiles(files)
          e.target.value = ''
        }}
      />

      {/* In-progress queue */}
      <AnimatePresence>
        {queue.map((file, i) => (
          <motion.div
            key={`${file.name}-${i}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 overflow-hidden rounded-lg border border-gray-200 bg-white p-3"
          >
            <FileText size={16} className="shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-700">{file.name}</p>
              {!file.error && !file.done && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <motion.div
                    className="h-full rounded-full bg-slate"
                    animate={{ width: `${file.progress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              )}
              {file.error && <p className="mt-0.5 text-xs text-red-500">{file.error}</p>}
            </div>
            {file.error ? (
              <AlertCircle size={14} className="shrink-0 text-red-400" />
            ) : file.done ? (
              <CheckCircle size={14} className="shrink-0 text-emerald-500" />
            ) : (
              <span className="text-xs text-gray-400">{file.progress}%</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Existing files */}
      {existingFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Uploaded</p>
          {existingFiles.map((file) => (
            <div
              key={file.url}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
            >
              <FileText size={16} className="shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gray-700">{file.name}</p>
                <p className="text-[10px] text-gray-400">{formatBytes(file.size)}</p>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={file.url}
                  download={file.name}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded p-1 text-gray-400 transition-colors hover:text-gray-600"
                >
                  <Download size={13} />
                </a>
                {file.id && onDeleteFile && (
                  <button
                    onClick={() => deleteFile(file.id!)}
                    className="rounded p-1 text-gray-400 transition-colors hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
