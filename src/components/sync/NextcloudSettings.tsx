import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { login } from '../../sync/Nextcloud'
import { saveCreds, toastError } from '../../utils/utils'
import { useSync } from '../../ContextProviders'
import { useDB } from '../../DB/DB'
import { invoke } from '@tauri-apps/api'

export function NextcloudSettings() {
  const urlRef = useRef<HTMLInputElement>(null)
  const interval = useRef(0)
  const { t } = useTranslation()
  const { setLoggedIn } = useSync()
  const {
    misc: { getSyncKey, setSyncKey },
  } = useDB()

  useEffect(() => {
    return () => clearInterval(interval.current)
  }, [])

  async function handleLogin(user: string, password: string, baseUrl: string) {
    /// Encrypt credentials before saving ///

    // get key from db
    let key = await getSyncKey()

    if (key === undefined) {
      const key: string = await invoke('generate_key')
      setSyncKey(key)
    }

    // encrypt user and password with keys and save credentials
    saveCreds('nextcloud', {
      server: baseUrl,
      loginName: await invoke('encrypt', { text: user, base64Key: key }),
      appPassword: await invoke('encrypt', { text: password, base64Key: key }),
    })

    setLoggedIn('nextcloud')
  }

  return (
    <div className="flex h-full w-full gap-2 p-1">
      <img className="h-24 shrink-0" src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Nextcloud_Logo.svg/141px-Nextcloud_Logo.svg.png" alt="Nextcloud logo" />
      <form
        className="flex w-full flex-col items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (urlRef.current) {
            try {
              interval.current = await login(urlRef.current.value, (user, password) => {
                handleLogin(user, password, urlRef.current?.value.split('index.php')[0] ?? '')
              })
            } catch (e) {
              toastError((e as Error).message)
            }
          }
        }}
      >
        <label className="flex w-full flex-col gap-1">
          {t('nextcloud_server_url')}
          <input type="url" className="rounded-md bg-primary-8 px-2 py-1 focus:outline-none" ref={urlRef} placeholder={t('nextcloud_server_url_example')} />
        </label>

        <button className="w-fit rounded-md bg-accent-6 p-1 px-4 uppercase hover:bg-accent-7">{t('connect')}</button>
      </form>
    </div>
  )
}