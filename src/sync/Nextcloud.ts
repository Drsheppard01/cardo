import { http, shell } from '@tauri-apps/api'
import { ProtocolFn } from '.'

export async function login(url: string, onSucess: (user: string, password: string) => void) {
  // nextcloud flow v2 o-auth login
  // https://docs.nextcloud.com/server/latest/developer_manual/client_apis/LoginFlow/index.html#login-flow-v2

  const baseUrl = url.split('index.php')[0] // clean possible extra paths in url, cannot guess subpaths without index.php

  const r = await http.fetch(baseUrl + '/index.php/login/v2', {
    method: 'POST',
    responseType: http.ResponseType.JSON,
  })

  const {
    login,
    poll: { token, endpoint },
  } = r.data as { login: string; poll: { token: string; endpoint: string } }

  shell.open(login) // throw explorer with nextcloud login page

  // start polling for a sucessful response of nextcloud
  const interval = setInterval(async () => {
    const r = await http.fetch(endpoint, {
      method: 'POST',
      responseType: http.ResponseType.JSON,
      body: {
        type: 'Json',
        payload: {
          token: token,
        },
      },
    })

    if (!r.ok) return // poll again

    // get credentials from response
    const { loginName, appPassword } = r.data as { server: string; loginName: string; appPassword: string }

    onSucess(loginName, appPassword)
    clearInterval(interval)
  }, 1000)
  return interval
}

export const nextcloudProtocol: ProtocolFn =  function(creds) {

  async function pullUpdates(request: string, since?: number) {
    const { server, user, password } = creds

    const url = server + `/index.php/apps/gpoddersync/${request}?since=${since === undefined ? '0' : since?.toString()}`

    const r: { data: any } = await http.fetch(url, {
      method: 'GET',
      responseType: http.ResponseType.JSON,
      headers: {
        'OCS-APIRequest': 'true',
        Authorization: 'Basic ' + btoa(user + ':' + password),
      },
    })

    return r.data
  }

  async function pushUpdates(request: string, updates: any) {
    const { server, user, password } = creds

    const url = server + `/index.php/apps/gpoddersync/${request}/create`

    const r = await http.fetch(url, {
      method: 'POST',
      responseType: http.ResponseType.JSON,
      headers: {
        'OCS-APIRequest': 'true',
        Authorization: 'Basic ' + btoa(user + ':' + password),
      },
      body: {
        type: 'Json',
        payload: updates,
      },
    })

    if (!r.ok) {
      throw Error('Failed pushing data to nextcloud server')
    }
  }

  return { login, pushUpdates, pullUpdates }
}