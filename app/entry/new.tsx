// app/entry/new.tsx and app/entry/[id]/edit.tsx share this component
// app/entry/new.tsx
import React, { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import EntryForm from '../../src/components/EntryForm';

export default function NewEntry() {
  return <EntryForm mode="new" />;
}
