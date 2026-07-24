import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  Button,
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  RingtoneKit,
  isRingtoneKitError,
  registerSoundProvider,
  type PreviewStateEvent,
  type Sound,
} from '@noirly-dev/react-native-ringtone-kit';

registerSoundProvider({
  id: 'example.demo',
  getSounds: async () => [
    {
      id: 'demo-tone',
      title: 'Demo Tone (provider)',
      category: 'custom',
      uri: 'file:///nonexistent-demo.m4a',
      source: 'custom-provider',
    },
  ],
  getSoundUri: async () => 'file:///nonexistent-demo.m4a',
});

export default function App() {
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [status, setStatus] = useState('idle');
  const [preview, setPreview] = useState<string>('none');
  const [category, setCategory] = useState<'alarm' | 'custom'>('alarm');

  const refresh = useCallback(async () => {
    try {
      const result = await RingtoneKit.getSounds(category);
      if (result.status === 'available') {
        setSounds(result.data);
        setStatus(`available (${result.data.length})`);
      } else if (result.status === 'unsupported') {
        setSounds([]);
        setStatus(`unsupported: ${result.reason}`);
      } else {
        setSounds([]);
        setStatus(`permission-required: ${result.permission}`);
      }
    } catch (error) {
      setStatus(isRingtoneKitError(error) ? error.code : 'error');
    }
  }, [category]);

  useEffect(() => {
    refresh().catch(console.error);
    const {remove} = RingtoneKit.addPreviewStateListener(
      (event: PreviewStateEvent) => {
        setPreview(`${event.status}:${event.soundId}`);
      },
    );
    return remove;
  }, [refresh]);

  const openPicker = async () => {
    try {
      const result = await RingtoneKit.openSystemPicker('alarm');
      if (result.status === 'available' && result.data) {
        Alert.alert('Picked', result.data.title);
        await refresh();
      } else if (result.status === 'unsupported') {
        Alert.alert('Unsupported', result.reason);
      }
    } catch (error) {
      Alert.alert('Error', isRingtoneKitError(error) ? error.message : String(error));
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>RingtoneKit Example</Text>
      <Text style={styles.meta}>
        {Platform.OS} · {category} · {status}
      </Text>
      <Text style={styles.meta}>preview: {preview}</Text>
      <View style={styles.row}>
        <Button title="Alarm" onPress={() => setCategory('alarm')} />
        <Button title="Custom" onPress={() => setCategory('custom')} />
        <Button title="Refresh" onPress={() => refresh()} />
        <Button title="System picker" onPress={openPicker} />
      </View>
      <FlatList
        data={sounds}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <View style={styles.item}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemMeta}>
              {item.source} · {item.category}
            </Text>
            <Button
              title="Preview"
              onPress={() => {
                RingtoneKit.previewSound(item.id).catch(error => {
                  Alert.alert(
                    'Preview failed',
                    isRingtoneKitError(error) ? error.message : String(error),
                  );
                });
              }}
            />
          </View>
        )}
      />
      <Button title="Stop preview" onPress={() => RingtoneKit.stopPreview()} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, padding: 16, backgroundColor: '#0b0f14'},
  title: {color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8},
  meta: {color: '#9ab', marginBottom: 4},
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12},
  item: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#234',
  },
  itemTitle: {color: '#eef', fontSize: 16, fontWeight: '600'},
  itemMeta: {color: '#789', marginBottom: 6},
});
