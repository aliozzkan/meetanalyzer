import { useOutletContext } from 'react-router'
import type { MeetingsApi } from '../features/meetings/use-meetings'
import type { NewMeetingApi } from '../features/meetings/use-new-meeting'
import type { ModelApi } from '../features/model/use-model'
import type { Recorder } from '../features/recording/use-recorder'
import type { DefaultLanguageApi } from '../features/settings/use-default-language'
import type { TranscriptionApi } from '../features/transcription/use-transcription'

// `AppLayout` rotasının alt rotalara `<Outlet context>` ile verdiği uygulama geneli durum.
export interface AppContext {
  meetings: MeetingsApi
  model: ModelApi
  transcription: TranscriptionApi
  recorder: Recorder
  defaultLanguage: DefaultLanguageApi
  newMeeting: NewMeetingApi
  /** Kayıt sürüyorsa önce Recording'i bitirir, sonra Meeting'i siler. */
  removeMeeting: (id: string) => Promise<boolean>
}

export function useAppContext(): AppContext {
  return useOutletContext<AppContext>()
}
