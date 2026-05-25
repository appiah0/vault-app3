// app/entry/[id]/edit.tsx
import { useLocalSearchParams } from 'expo-router';
import EntryForm from '../../../src/components/EntryForm';

export default function EditEntry() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EntryForm mode="edit" entryId={id} />;
}
