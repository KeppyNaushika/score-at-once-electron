"use client"

import { KeyboardShortcutSection } from "@/app/(app)/settings/components/KeyboardShortcutSection"
import { useKeyboardSettings } from "@/app/(app)/settings/hooks/useKeyboardSettings"

export default function KeyboardSettingsPage() {
  const {
    shortcuts,
    editingKey,
    pendingKey,
    modifierKeyLabel,
    handleKeyEdit,
    handleKeySave,
    handleKeyCancel,
    handleReset,
    getKeyDisplayName,
  } = useKeyboardSettings()

  return (
    <KeyboardShortcutSection
      shortcuts={shortcuts}
      editingKey={editingKey}
      pendingKey={pendingKey}
      modifierKeyLabel={modifierKeyLabel}
      onKeyEdit={handleKeyEdit}
      onKeySave={handleKeySave}
      onKeyCancel={handleKeyCancel}
      onReset={handleReset}
      getKeyDisplayName={getKeyDisplayName}
    />
  )
}
