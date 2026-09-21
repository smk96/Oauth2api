;(function () {
  'use strict'

  const CONFIG = {
    STORAGE_KEY: 'emailData',
    GROUP_KEY: 'emailGroups',
    PASSWORD_KEY: 'password',
    MAIL_LIMIT_KEY: 'mailLimit',
    SIDEBAR_WIDTH_KEY: 'mailSidebarWidth',
    ACCESS_SESSION_KEY: 'mailAccessGranted',
    ACCESS_SESSION_VERSION: '2',
    ACCESS_USERNAME_KEY: 'mailAccessUsername',
    ACCESS_PASSWORD_KEY: 'mailAccessPassword',
    ACCESS_DEFAULT_USERNAME: 'admin',
    ACCESS_DEFAULT_PASSWORD: 'admin123',
    DEFAULT_GROUP: '默认分组',
    MAIL_ITEMS_PER_PAGE: 10,
    API_BASE: '/api/mail-all',
    REFRESH_TOKEN_API: '/api/refresh-token',
    STORE_STATE_API: '/api/store-state',
    STORE_EMAILS_API: '/api/store-emails',
    STORE_GROUPS_API: '/api/store-groups'
  }

  const AUTH_ERROR_MESSAGE = '密码验证失败，请输入正确访问密码'

  const state = {
    currentPage: 1,
    currentMailPage: 1,
    itemsPerPage: 5,
    selectedItems: [],
    searchKeyword: '',
    groupFilter: 'all',
    storeMode: 'browser',
    groups: [],
    emailData: [],
    mailData: [],
    activeNoteIndex: null,
    activeMoveIndexes: [],
    deleteMode: 'selected',
    activeRenameGroup: null,
    activeRefreshIndexes: [],
    currentMailAccount: null,
    currentMailbox: 'INBOX'
  }

  const $ = (sel, ctx = document) => ctx.querySelector(sel)
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel))

  const showLoading = () => { $('#loading-overlay').style.display = 'flex' }
  const hideLoading = () => { $('#loading-overlay').style.display = 'none' }

  const openModal = (id) => { $(`#${id}`).style.display = 'flex' }
  const closeAllModals = () => $$('.modal-overlay').forEach(el => { el.style.display = 'none' })

  const getEmailData = () => state.emailData || []

  const saveEmailsToStore = (emails) => {
    if (state.storeMode !== 'server') return
    fetch(CONFIG.STORE_EMAILS_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails })
    }).catch(err => {
      console.error('Save emails failed:', err)
      showToast('数据库保存邮箱失败')
    })
  }

  const saveGroupsToStore = (groups) => {
    if (state.storeMode !== 'server') return
    fetch(CONFIG.STORE_GROUPS_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groups })
    }).catch(err => {
      console.error('Save groups failed:', err)
      showToast('数据库保存分组失败')
    })
  }

  const setEmailData = (data) => {
    state.emailData = (data || []).map(normalizeItem)
    if (state.storeMode === 'server') {
      saveEmailsToStore(state.emailData)
    } else {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.emailData))
    }
  }

  const getGroups = () => {
    const groups = state.groups || []
    return groups.includes(CONFIG.DEFAULT_GROUP) ? groups : [CONFIG.DEFAULT_GROUP, ...groups]
  }

  const setGroups = (groups) => {
    const next = [CONFIG.DEFAULT_GROUP, ...(groups || []).filter(g => g && g !== CONFIG.DEFAULT_GROUP)]
    state.groups = [...new Set(next)]
    if (state.storeMode === 'server') {
      saveGroupsToStore(state.groups)
    } else {
      localStorage.setItem(CONFIG.GROUP_KEY, JSON.stringify(state.groups))
    }
  }
  const getPassword = () => localStorage.getItem(CONFIG.PASSWORD_KEY) || ''
  const setPassword = (pwd) => localStorage.setItem(CONFIG.PASSWORD_KEY, pwd)
  const getAccessUsername = () => localStorage.getItem(CONFIG.ACCESS_USERNAME_KEY) || CONFIG.ACCESS_DEFAULT_USERNAME
  const getAccessPassword = () => localStorage.getItem(CONFIG.ACCESS_PASSWORD_KEY) || CONFIG.ACCESS_DEFAULT_PASSWORD
  const migrateLegacyAccessCredentials = () => {
    const username = localStorage.getItem(CONFIG.ACCESS_USERNAME_KEY)
    const password = localStorage.getItem(CONFIG.ACCESS_PASSWORD_KEY)

    if (username === 'adinm' && password === 'adinm123') {
      localStorage.removeItem(CONFIG.ACCESS_USERNAME_KEY)
      localStorage.removeItem(CONFIG.ACCESS_PASSWORD_KEY)
      sessionStorage.removeItem(CONFIG.ACCESS_SESSION_KEY)
    }
  }
  const setAccessCredentials = (username, password) => {
    localStorage.setItem(CONFIG.ACCESS_USERNAME_KEY, username || CONFIG.ACCESS_DEFAULT_USERNAME)
    if (password) localStorage.setItem(CONFIG.ACCESS_PASSWORD_KEY, password)
  }

  const showToast = (message) => {
    const toast = $('#toast')
    toast.textContent = message
    toast.style.display = 'block'
    clearTimeout(showToast.timer)
    showToast.timer = setTimeout(() => { toast.style.display = 'none' }, 2200)
  }

  const isAccessGranted = () => sessionStorage.getItem(CONFIG.ACCESS_SESSION_KEY) === CONFIG.ACCESS_SESSION_VERSION

  const unlockAccess = () => {
    sessionStorage.setItem(CONFIG.ACCESS_SESSION_KEY, CONFIG.ACCESS_SESSION_VERSION)
    document.body.classList.remove('access-locked')
  }

  const initAccessGate = () => {
    if (isAccessGranted()) {
      document.body.classList.remove('access-locked')
      return
    }

    const form = $('#access-form')
    const username = $('#access-username')
    const password = $('#access-password')
    const error = $('#access-error')

    form.addEventListener('submit', e => {
      e.preventDefault()
      if (username.value.trim() === getAccessUsername() && password.value === getAccessPassword()) {
        error.textContent = ''
        unlockAccess()
        return
      }

      error.textContent = '账号或密码错误'
      password.value = ''
      password.focus()
    })

    username.value = ''
    password.value = ''
    username.focus()
  }

  const openAccessSettingsModal = () => {
    $('#access-settings-username').value = getAccessUsername()
    $('#access-settings-password').value = ''
    $('#access-settings-password-confirm').value = ''
    openModal('access-settings-modal')
    $('#access-settings-username').focus()
  }

  const saveAccessSettings = () => {
    const username = $('#access-settings-username').value.trim()
    const password = $('#access-settings-password').value
    const confirmPassword = $('#access-settings-password-confirm').value

    if (!username) return showToast('请输入登录用户名')
    if (password || confirmPassword) {
      if (password.length < 3) return showToast('新密码至少 3 位')
      if (password !== confirmPassword) return showToast('两次输入的新密码不一致')
    }

    setAccessCredentials(username, password)
    closeAllModals()
    showToast('登录设置已保存')
  }

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  const formatDateTime = (value) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)

    const pad = number => String(number).padStart(2, '0')
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  const copyText = async (value, label = '内容') => {
    const text = String(value || '')
    if (!text) return showToast(`没有可复制的${label}`)

    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      const input = document.createElement('textarea')
      input.value = text
      input.style.position = 'fixed'
      input.style.left = '-9999px'
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }

    showToast(`${label}已复制`)
  }

  const initSidebarResizer = () => {
    const shell = $('.app-shell')
    const sidebar = $('.sidebar')
    const resizer = $('#sidebar-resizer')
    if (!shell || !sidebar || !resizer) return

    const desktopQuery = window.matchMedia('(min-width: 1101px)')
    const minWidth = 260
    const getMaxWidth = () => Math.max(minWidth, Math.min(520, Math.floor(window.innerWidth * 0.42)))
    const clampWidth = width => Math.min(getMaxWidth(), Math.max(minWidth, Math.round(width)))
    const setWidth = (width, persist = true) => {
      const next = clampWidth(width)
      shell.style.setProperty('--sidebar-width', `${next}px`)
      resizer.setAttribute('aria-valuemin', String(minWidth))
      resizer.setAttribute('aria-valuemax', String(getMaxWidth()))
      resizer.setAttribute('aria-valuenow', String(next))
      if (persist) localStorage.setItem(CONFIG.SIDEBAR_WIDTH_KEY, String(next))
    }
    const restoreSavedWidth = () => {
      const saved = Number(localStorage.getItem(CONFIG.SIDEBAR_WIDTH_KEY))
      if (desktopQuery.matches && Number.isFinite(saved) && saved > 0) setWidth(saved, false)
    }

    restoreSavedWidth()

    resizer.addEventListener('pointerdown', event => {
      if (!desktopQuery.matches || event.button !== 0) return
      event.preventDefault()
      resizer.setPointerCapture(event.pointerId)
      document.body.classList.add('sidebar-resizing')

      const onMove = moveEvent => setWidth(moveEvent.clientX, false)
      const onEnd = endEvent => {
        resizer.releasePointerCapture(endEvent.pointerId)
        resizer.removeEventListener('pointermove', onMove)
        resizer.removeEventListener('pointerup', onEnd)
        resizer.removeEventListener('pointercancel', onEnd)
        document.body.classList.remove('sidebar-resizing')
        localStorage.setItem(CONFIG.SIDEBAR_WIDTH_KEY, String(Math.round(sidebar.getBoundingClientRect().width)))
      }

      resizer.addEventListener('pointermove', onMove)
      resizer.addEventListener('pointerup', onEnd)
      resizer.addEventListener('pointercancel', onEnd)
    })

    resizer.addEventListener('dblclick', () => {
      localStorage.removeItem(CONFIG.SIDEBAR_WIDTH_KEY)
      shell.style.removeProperty('--sidebar-width')
      resizer.removeAttribute('aria-valuenow')
    })

    resizer.addEventListener('keydown', event => {
      if (!desktopQuery.matches) return
      const current = sidebar.getBoundingClientRect().width
      if (event.key === 'ArrowLeft') setWidth(current - 16)
      else if (event.key === 'ArrowRight') setWidth(current + 16)
      else if (event.key === 'Home') {
        localStorage.removeItem(CONFIG.SIDEBAR_WIDTH_KEY)
        shell.style.removeProperty('--sidebar-width')
      } else return
      event.preventDefault()
    })

    window.addEventListener('resize', () => {
      if (!desktopQuery.matches) return
      const saved = Number(localStorage.getItem(CONFIG.SIDEBAR_WIDTH_KEY))
      if (Number.isFinite(saved) && saved > 0) setWidth(saved, false)
    })
  }

  const normalizeItem = (item) => ({
    email: item.email || '',
    password: item.password || '',
    clientId: item.clientId || '',
    refreshToken: item.refreshToken || '',
    group: item.group || CONFIG.DEFAULT_GROUP,
    note: item.note || ''
  })

  const loadStoreState = async () => {
    try {
      const response = await fetch(CONFIG.STORE_STATE_API, { cache: 'no-store' })
      if (!response.ok) throw new Error(`store api ${response.status}`)

      const data = await response.json()
      state.storeMode = 'server'
      state.emailData = Array.isArray(data.emails) ? data.emails.map(normalizeItem) : []
      state.groups = Array.isArray(data.groups) && data.groups.length ? data.groups : [CONFIG.DEFAULT_GROUP]

      const legacyEmails = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]')
      const legacyGroups = JSON.parse(localStorage.getItem(CONFIG.GROUP_KEY) || '[]')
      if (state.emailData.length === 0 && legacyEmails.length > 0) {
        state.emailData = legacyEmails.map(normalizeItem)
        state.groups = [...new Set([...state.groups, ...legacyGroups, ...state.emailData.map(item => item.group)])]
        saveGroupsToStore(state.groups)
        saveEmailsToStore(state.emailData)
        showToast('已将浏览器本地邮箱数据迁移到 VPS 数据库')
      }
      return
    } catch (err) {
      console.warn('Server store unavailable, fallback to browser storage:', err)
      state.storeMode = 'browser'
      state.emailData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]').map(normalizeItem)
      const groups = JSON.parse(localStorage.getItem(CONFIG.GROUP_KEY) || '[]')
      state.groups = groups.length ? groups : [CONFIG.DEFAULT_GROUP]
    }
  }

  const normalizeStorage = () => {
    const data = getEmailData().map(normalizeItem)
    setEmailData(data)
    const groups = new Set(getGroups())
    data.forEach(item => groups.add(item.group || CONFIG.DEFAULT_GROUP))
    setGroups([...groups])
  }

  const fillSelect = (select, groups, options = {}) => {
    const { includeAll = false, value } = options
    select.innerHTML = [
      includeAll ? '<option value="all">全部分组</option>' : '',
      ...groups.map(group => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`)
    ].join('')
    if (value) select.value = value
  }

  const refreshGroupControls = () => {
    const groups = getGroups()
    fillSelect($('#import-group'), groups, { value: CONFIG.DEFAULT_GROUP })
    fillSelect($('#group-filter'), groups, { includeAll: true, value: state.groupFilter })
    fillSelect($('#move-target-group'), groups, { value: CONFIG.DEFAULT_GROUP })
  }

  const getFilteredData = () => {
    const kw = state.searchKeyword.toLowerCase()
    return getEmailData()
      .map((item, index) => ({ ...normalizeItem(item), index }))
      .filter(item => state.groupFilter === 'all' || item.group === state.groupFilter)
      .filter(item => !kw || item.email.toLowerCase().includes(kw))
  }

  const selectedVisibleIndexes = () => {
    const visible = new Set(getFilteredData().map(item => String(item.index)))
    return state.selectedItems.filter(index => visible.has(index))
  }

  const updateBatchButtons = () => {
    const count = selectedVisibleIndexes().length
    $('#batch-move-btn').disabled = count === 0
    $('#batch-delete-btn').disabled = count === 0
  }

  const renderTable = () => {
    const tbody = $('#email-table tbody')
    const filtered = getFilteredData()
    const start = (state.currentPage - 1) * state.itemsPerPage
    const pageData = filtered.slice(start, start + state.itemsPerPage)

    $('#record-count').textContent = `${filtered.length} 条记录`

    if (pageData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无数据</td></tr>'
      renderPagination()
      updateSelectAllState()
      updateBatchButtons()
      return
    }

    tbody.innerHTML = pageData.map((item, i) => `
      <tr data-index="${item.index}">
        <td class="check-col"><input type="checkbox" data-index="${item.index}" ${state.selectedItems.includes(String(item.index)) ? 'checked' : ''}></td>
        <td class="seq-cell">${start + i + 1}</td>
        <td title="${escapeHtml(item.email)}">
          <div class="copy-cell">
            <span>${escapeHtml(item.email)}</span>
            <button class="copy-btn" data-action="copy-email" title="复制邮箱">▣</button>
          </div>
        </td>
        <td title="${escapeHtml(item.password)}">
          <div class="copy-cell">
            <span>${escapeHtml(item.password || '-')}</span>
            <button class="copy-btn" data-action="copy-password" title="复制密码">▣</button>
          </div>
        </td>
        <td class="tag-cell"><span class="tag">${escapeHtml(item.group)}</span></td>
        <td title="${escapeHtml(item.note)}">${item.note ? escapeHtml(item.note) : '<span class="note-empty">暂无备注</span>'}</td>
        <td>
          <div class="actions">
            <button class="link-btn" data-action="note">备注</button>
            <button class="link-btn" data-action="inbox">查看邮件</button>
            <button class="link-btn" data-action="move">移动</button>
            <button class="link-btn danger" data-action="delete">删除</button>
          </div>
        </td>
      </tr>
    `).join('')

    renderPagination()
    updateSelectAllState()
    updateBatchButtons()
  }

  const updateSelectAllState = () => {
    const selectAll = $('#select-all')
    const indexes = getFilteredData().map(item => String(item.index))
    const selected = indexes.filter(index => state.selectedItems.includes(index))
    selectAll.checked = indexes.length > 0 && selected.length === indexes.length
    selectAll.indeterminate = selected.length > 0 && selected.length < indexes.length
  }

  const renderPagination = () => {
    const total = getFilteredData().length
    const totalPages = Math.max(1, Math.ceil(total / state.itemsPerPage))
    if (state.currentPage > totalPages) state.currentPage = totalPages

    $('#pagination-info').textContent = `共 ${total} 条`

    if (totalPages <= 1) {
      $('#pagination-btns').innerHTML = ''
      return
    }

    let html = `<button ${state.currentPage === 1 ? 'disabled' : ''} data-page="${state.currentPage - 1}">‹</button>`
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="${i === state.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`
    }
    html += `<button ${state.currentPage === totalPages ? 'disabled' : ''} data-page="${state.currentPage + 1}">›</button>`
    $('#pagination-btns').innerHTML = html
  }

  const parseImportText = (text, delimiter, group) => {
    const looksLikeRefreshToken = (value) => {
      const token = String(value || '').trim()
      if (!token) return false
      return token.length > 80 || token.includes('.') || token.includes('!')
    }

    return text.split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const fields = line.split(delimiter).map(s => s.trim())
        if (fields.length < 2) return null
        const [email, password, third = '', fourth = '', note = ''] = fields
        if (!email || !password) return null

        let clientId = third
        let refreshToken = fourth
        if (fields.length >= 4 && looksLikeRefreshToken(third) && !looksLikeRefreshToken(fourth)) {
          refreshToken = third
          clientId = fourth
        }

        return { email, password, clientId, refreshToken, note, group }
      })
      .filter(Boolean)
  }

  const appendImportedItems = (items) => {
    if (!items.length) {
      showToast('没有识别到有效数据')
      return
    }
    const data = getEmailData().map(normalizeItem)
    data.push(...items)
    setEmailData(data)
    setGroups([...new Set([...getGroups(), ...items.map(item => item.group)])])
    refreshGroupControls()
    state.currentPage = 1
    renderTable()
    showToast(`导入成功，共 ${items.length} 条`)
  }

  const importFromFile = (file) => {
    const delimiter = $('#import-delimiter').value.trim()
    const group = $('#import-group').value || CONFIG.DEFAULT_GROUP
    if (!delimiter) return showToast('请输入分隔符')

    const reader = new FileReader()
    reader.onload = (e) => appendImportedItems(parseImportText(e.target.result, delimiter, group))
    reader.readAsText(file)
  }

  const exportData = () => {
    const selectedGroup = $('#group-filter')?.value || state.groupFilter || 'all'
    const allData = getEmailData().map(normalizeItem)
    const data = selectedGroup === 'all'
      ? allData
      : allData.filter(item => item.group === selectedGroup)

    if (!data.length) {
      showToast(selectedGroup === 'all' ? '暂无可导出的邮箱' : '当前分组暂无可导出的邮箱')
      return
    }

    const lines = data.map(item => [item.email, item.password, item.clientId, item.refreshToken, item.group, item.note].join('----'))
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const groupName = selectedGroup === 'all' ? 'all' : selectedGroup.replace(/[\\/:*?"<>|]/g, '_')
    a.download = `emails-${groupName}-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    showToast(selectedGroup === 'all' ? `已导出全部 ${data.length} 条` : `已导出 ${selectedGroup} 分组 ${data.length} 条`)
  }

  const deleteByIndexes = (indexes) => {
    const selected = new Set(indexes.map(Number))
    const data = getEmailData().filter((_, index) => !selected.has(index))
    setEmailData(data)
    state.selectedItems = []
    renderTable()
  }

  const getRefreshTargetIndexes = () => {
    const selected = selectedVisibleIndexes()
    if (selected.length) return selected.map(Number)
    return getFilteredData().map(item => item.index)
  }

  const openRefreshTokenModal = () => {
    const indexes = getRefreshTargetIndexes()
    if (!indexes.length) return showToast('当前没有可刷新的邮箱')
    state.activeRefreshIndexes = indexes
    $('#refresh-token-count').textContent = indexes.length
    openModal('refresh-token-modal')
  }

  const refreshOneToken = async (mail) => {
    if (!mail.clientId || !mail.refreshToken) {
      throw new Error('缺少 Client ID 或 Refresh Token')
    }

    const response = await fetch(CONFIG.REFRESH_TOKEN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: mail.clientId,
        refresh_token: mail.refreshToken,
        password: getPassword()
      })
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      const error = new Error(err.error || `刷新失败: ${response.status}`)
      error.status = response.status
      throw error
    }

    const data = await response.json()
    return data.refresh_token || mail.refreshToken
  }

  const executeBatchRefreshTokens = async () => {
    const indexes = state.activeRefreshIndexes.map(Number)
    if (!indexes.length) return closeAllModals()

    closeAllModals()
    showLoading()

    const data = getEmailData().map(normalizeItem)
    let success = 0
    let failed = 0
    let authFailed = false

    for (const index of indexes) {
      const item = data[index]
      if (!item) continue

      try {
        item.refreshToken = await refreshOneToken(item)
        success++
      } catch (err) {
        if (err.status === 401) {
          authFailed = true
          break
        }
        failed++
        console.error(`刷新 ${item.email} Token 失败:`, err)
      }
    }

    setEmailData(data)
    state.selectedItems = []
    state.activeRefreshIndexes = []
    renderTable()
    hideLoading()

    if (authFailed) {
      showToast(AUTH_ERROR_MESSAGE)
    } else if (failed > 0) {
      showToast(`刷新完成：成功 ${success} 个，失败 ${failed} 个`)
    } else {
      showToast(`刷新成功：共 ${success} 个`)
    }
  }

  const openMoveModal = (indexes) => {
    state.activeMoveIndexes = indexes.map(String)
    $('#move-count').textContent = `将移动 ${state.activeMoveIndexes.length} 个邮箱`
    openModal('move-modal')
  }

  const moveActiveItems = () => {
    const target = $('#move-target-group').value
    const selected = new Set(state.activeMoveIndexes.map(Number))
    const data = getEmailData().map((item, index) => selected.has(index) ? { ...normalizeItem(item), group: target } : normalizeItem(item))
    setEmailData(data)
    state.selectedItems = []
    closeAllModals()
    renderTable()
    showToast('移动成功')
  }

  const renderGroupList = () => {
    const groups = getGroups()
    const counts = getEmailData().reduce((acc, item) => {
      const group = normalizeItem(item).group
      acc[group] = (acc[group] || 0) + 1
      return acc
    }, {})

    $('#group-total-count').textContent = groups.length
    $('#group-list').innerHTML = groups.map(group => `
      <div class="group-row" data-group="${escapeHtml(group)}">
        <div class="group-folder">▱</div>
        <div class="group-main">
          <strong>${escapeHtml(group)}${group === CONFIG.DEFAULT_GROUP ? '<span class="default-badge">默认</span>' : ''}</strong>
          <small>${counts[group] || 0} 条邮箱记录</small>
        </div>
        <div class="group-actions">
          <button class="group-icon-btn" data-action="rename-group" title="编辑分组">⌑</button>
          ${group === CONFIG.DEFAULT_GROUP ? '' : '<button class="group-icon-btn danger" data-action="delete-group" title="删除分组">⌫</button>'}
        </div>
      </div>
    `).join('')
  }

  const addGroup = () => {
    const input = $('#new-group-name')
    const name = input.value.trim()
    if (!name) return showToast('请输入分组名称')
    if (getGroups().includes(name)) return showToast('分组已存在')
    setGroups([...getGroups(), name])
    input.value = ''
    $('#group-create').classList.add('collapsed')
    refreshGroupControls()
    renderGroupList()
    showToast('分组已新增')
  }

  const renameGroup = () => {
    const oldName = state.activeRenameGroup
    const newName = $('#rename-group-name').value.trim()
    if (!oldName || !newName) return showToast('请输入分组名称')
    if (newName !== oldName && getGroups().includes(newName)) return showToast('分组已存在')

    const data = getEmailData().map(item => {
      const normalized = normalizeItem(item)
      return normalized.group === oldName ? { ...normalized, group: newName } : normalized
    })
    const groups = getGroups().map(group => group === oldName ? newName : group)

    setEmailData(data)
    setGroups(groups)
    if (state.groupFilter === oldName) state.groupFilter = newName
    refreshGroupControls()
    renderGroupList()
    renderTable()
    closeAllModals()
    showToast('分组已更新')
  }

  const deleteGroup = (group) => {
    const data = getEmailData().map(item => {
      const normalized = normalizeItem(item)
      return normalized.group === group ? { ...normalized, group: CONFIG.DEFAULT_GROUP } : normalized
    })
    setEmailData(data)
    setGroups(getGroups().filter(item => item !== group))
    if (state.groupFilter === group) state.groupFilter = 'all'
    refreshGroupControls()
    renderGroupList()
    renderTable()
    showToast('分组已删除，邮箱已移动到默认分组')
  }

  const showMailSection = () => {
    $$('.section').forEach(s => s.classList.remove('active'))
    $('#mail-section').classList.add('active')
  }

  const showAccountSection = () => {
    $$('.section').forEach(s => s.classList.remove('active'))
    $('#account-section').classList.add('active')
    state.currentMailPage = 1
    state.mailData = []
  }

  const loadMailList = (mail, mailbox) => {
    if (!mail.refreshToken || !mail.clientId) {
      showToast('该邮箱缺少 Client ID 或 Refresh Token')
      return
    }

    showLoading()
    state.currentMailAccount = mail
    state.currentMailbox = mailbox
    state.currentMailPage = 1
    $('#mail-title').textContent = `${mail.email} 的邮件`
    $('#mail-subtitle').textContent = mailbox === 'Junk' ? '垃圾邮箱' : '收件箱'
    $('#mailbox-switch').value = mailbox

    const params = new URLSearchParams({
      refresh_token: mail.refreshToken,
      client_id: mail.clientId,
      email: mail.email,
      mailbox,
      response_type: 'json',
      password: getPassword()
    })

    fetch(`${CONFIG.API_BASE}?${params.toString()}`)
      .then(r => {
        if (!r.ok) {
          if (r.status === 401) throw new Error(AUTH_ERROR_MESSAGE)
          return r.json().then(d => { throw new Error(d.error || `请求失败: ${r.status}`) })
        }
        return r.json()
      })
      .then(d => {
        const limitSetting = localStorage.getItem(CONFIG.MAIL_LIMIT_KEY) || '2'
        const allMail = Array.isArray(d) ? d : []
        const limit = Number(limitSetting) || 2
        state.mailData = limitSetting === 'all' ? allMail : allMail.slice(0, limit)
        showMailSection()
        renderMailTable()
      })
      .catch(err => showToast(err.message || '加载失败'))
      .finally(hideLoading)
  }

  const renderMailTable = () => {
    const tbody = $('#mail-table tbody')
    const start = (state.currentMailPage - 1) * CONFIG.MAIL_ITEMS_PER_PAGE
    const pageData = state.mailData.slice(start, start + CONFIG.MAIL_ITEMS_PER_PAGE)

    if (!pageData.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">暂无邮件</td></tr>'
      $('#mail-pagination-btns').innerHTML = ''
      return
    }

    tbody.innerHTML = pageData.map((item, i) => `
      <tr data-index="${start + i}">
        <td title="${escapeHtml(item.send)}">${escapeHtml(item.send)}</td>
        <td title="${escapeHtml(item.subject)}">${escapeHtml(item.subject || '(无主题)')}</td>
        <td title="${escapeHtml(item.date)}">${escapeHtml(formatDateTime(item.date))}</td>
        <td>
          <div class="actions">
            <button class="link-btn" data-action="view">查看</button>
          </div>
        </td>
      </tr>
    `).join('')

    renderMailPagination()
  }

  const renderMailPagination = () => {
    const totalPages = Math.ceil(state.mailData.length / CONFIG.MAIL_ITEMS_PER_PAGE)
    if (totalPages <= 1) {
      $('#mail-pagination-btns').innerHTML = ''
      return
    }
    let html = `<button ${state.currentMailPage === 1 ? 'disabled' : ''} data-page="${state.currentMailPage - 1}">‹</button>`
    for (let i = 1; i <= totalPages; i++) html += `<button class="${i === state.currentMailPage ? 'active' : ''}" data-page="${i}">${i}</button>`
    html += `<button ${state.currentMailPage === totalPages ? 'disabled' : ''} data-page="${state.currentMailPage + 1}">›</button>`
    $('#mail-pagination-btns').innerHTML = html
  }

  const viewMailDetail = (index) => {
    const item = state.mailData[index]
    if (!item) return
    $('#mail-modal-title').textContent = item.subject || '(无主题)'
    $('#mail-modal-sender').textContent = item.send || '-'
    $('#mail-modal-date').textContent = formatDateTime(item.date)
    const content = $('#mail-modal-content')
    content.replaceChildren()
    if (item.html) {
      const iframe = document.createElement('iframe')
      iframe.setAttribute('sandbox', '')
      iframe.setAttribute('referrerpolicy', 'no-referrer')
      iframe.srcdoc = item.html
      content.appendChild(iframe)
    } else {
      const pre = document.createElement('pre')
      pre.textContent = item.text || ''
      pre.style.cssText = 'white-space:pre-wrap;word-wrap:break-word;margin:0;'
      content.appendChild(pre)
    }
    openModal('mail-modal')
  }

  const bindEvents = () => {
    $('#search-input').addEventListener('input', e => {
      state.searchKeyword = e.target.value.trim()
      state.currentPage = 1
      renderTable()
    })

    $('#group-filter').addEventListener('change', e => {
      state.groupFilter = e.target.value
      state.currentPage = 1
      state.selectedItems = []
      renderTable()
    })

    $('#per-page').addEventListener('change', e => {
      state.itemsPerPage = Number(e.target.value)
      state.currentPage = 1
      renderTable()
    })

    $('#mail-limit').addEventListener('change', e => {
      localStorage.setItem(CONFIG.MAIL_LIMIT_KEY, e.target.value)
    })

    $('#toolbar-password').addEventListener('input', e => setPassword(e.target.value.trim()))

    $('#select-all').addEventListener('change', e => {
      const indexes = getFilteredData().map(item => String(item.index))
      state.selectedItems = e.target.checked ? [...new Set([...state.selectedItems, ...indexes])] : state.selectedItems.filter(index => !indexes.includes(index))
      renderTable()
    })

    $('#email-table tbody').addEventListener('change', e => {
      if (e.target.type !== 'checkbox') return
      const index = e.target.dataset.index
      state.selectedItems = e.target.checked ? [...new Set([...state.selectedItems, index])] : state.selectedItems.filter(item => item !== index)
      updateSelectAllState()
      updateBatchButtons()
    })

    $('#email-table tbody').addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const index = Number(btn.closest('tr').dataset.index)
      const item = normalizeItem(getEmailData()[index])
      switch (btn.dataset.action) {
        case 'copy-email':
          copyText(item.email, '邮箱')
          break
        case 'copy-password':
          copyText(item.password, '密码')
          break
        case 'note':
          state.activeNoteIndex = index
          $('#note-text').value = item.note || ''
          openModal('note-modal')
          break
        case 'inbox':
          loadMailList(item, 'INBOX')
          break
        case 'move':
          openMoveModal([index])
          break
        case 'delete':
          $('#delete-confirm-count').textContent = 1
          state.selectedItems = [String(index)]
          state.deleteMode = 'selected'
          openModal('delete-confirm-modal')
          break
      }
    })

    $('#pagination-btns').addEventListener('click', e => {
      const btn = e.target.closest('button[data-page]')
      if (!btn || btn.disabled) return
      state.currentPage = Number(btn.dataset.page)
      renderTable()
    })

    $('#batch-delete-btn').addEventListener('click', () => {
      const indexes = selectedVisibleIndexes()
      if (!indexes.length) return showToast('请先选择邮箱')
      $('#delete-confirm-count').textContent = indexes.length
      state.deleteMode = 'selected'
      openModal('delete-confirm-modal')
    })

    $('#delete-confirm-submit').addEventListener('click', () => {
      if (state.deleteMode === 'all') {
        setEmailData([])
        state.selectedItems = []
        state.currentPage = 1
        renderTable()
      } else {
        deleteByIndexes(selectedVisibleIndexes())
      }
      closeAllModals()
      showToast('删除成功')
    })

    $('#batch-move-btn').addEventListener('click', () => {
      const indexes = selectedVisibleIndexes()
      if (!indexes.length) return showToast('请先选择邮箱')
      openMoveModal(indexes)
    })

    $('#move-confirm').addEventListener('click', moveActiveItems)
    $('#batch-refresh-token-btn').addEventListener('click', openRefreshTokenModal)
    $('#refresh-token-confirm').addEventListener('click', executeBatchRefreshTokens)

    $('#note-confirm').addEventListener('click', () => {
      const data = getEmailData().map(normalizeItem)
      if (data[state.activeNoteIndex]) data[state.activeNoteIndex].note = $('#note-text').value.trim()
      setEmailData(data)
      closeAllModals()
      renderTable()
      showToast('备注已保存')
    })

    $('#paste-import-btn').addEventListener('click', () => openModal('paste-import-modal'))
    $('#paste-import-confirm').addEventListener('click', () => {
      const delimiter = $('#import-delimiter').value.trim()
      const group = $('#import-group').value || CONFIG.DEFAULT_GROUP
      appendImportedItems(parseImportText($('#paste-import-text').value, delimiter, group))
      $('#paste-import-text').value = ''
      closeAllModals()
    })

    $('#clear-all-btn').addEventListener('click', () => {
      const total = getEmailData().length
      if (!total) return showToast('暂无可清空邮箱')
      state.deleteMode = 'all'
      $('#delete-confirm-count').textContent = total
      openModal('delete-confirm-modal')
    })

    $('#export-btn').addEventListener('click', exportData)
    $('#top-export-btn').addEventListener('click', exportData)
    $('#access-settings-btn').addEventListener('click', openAccessSettingsModal)
    $('#access-settings-save').addEventListener('click', saveAccessSettings)
    $('#group-manage-btn').addEventListener('click', () => {
      $('#group-create').classList.add('collapsed')
      renderGroupList()
      openModal('group-modal')
    })
    $('#show-add-group-btn').addEventListener('click', () => {
      $('#group-create').classList.toggle('collapsed')
      $('#new-group-name').focus()
    })
    $('#add-group-btn').addEventListener('click', addGroup)
    $('#rename-group-confirm').addEventListener('click', renameGroup)
    $('#group-list').addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const group = btn.closest('.group-row').dataset.group
      if (btn.dataset.action === 'delete-group') {
        deleteGroup(group)
      }
      if (btn.dataset.action === 'rename-group') {
        state.activeRenameGroup = group
        $('#rename-group-name').value = group
        openModal('rename-group-modal')
      }
    })

    $('#back-btn').addEventListener('click', showAccountSection)
    $('#mailbox-switch').addEventListener('change', e => {
      if (!state.currentMailAccount) return
      loadMailList(state.currentMailAccount, e.target.value)
    })
    $('#mail-table tbody').addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const index = Number(btn.closest('tr').dataset.index)
      if (btn.dataset.action === 'view') viewMailDetail(index)
    })
    $('#mail-pagination-btns').addEventListener('click', e => {
      const btn = e.target.closest('button[data-page]')
      if (!btn || btn.disabled) return
      state.currentMailPage = Number(btn.dataset.page)
      renderMailTable()
    })

    $$('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay || e.target.hasAttribute('data-close')) closeAllModals()
      })
    })

    const uploadBox = $('#upload-box')
    const fileInput = $('#import-file')
    uploadBox.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) importFromFile(fileInput.files[0])
      fileInput.value = ''
    })
    uploadBox.addEventListener('dragover', e => {
      e.preventDefault()
      uploadBox.classList.add('dragover')
    })
    uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('dragover'))
    uploadBox.addEventListener('drop', e => {
      e.preventDefault()
      uploadBox.classList.remove('dragover')
      if (e.dataTransfer.files[0]) importFromFile(e.dataTransfer.files[0])
    })
  }

  const init = async () => {
    migrateLegacyAccessCredentials()
    initAccessGate()
    initSidebarResizer()
    await loadStoreState()
    normalizeStorage()
    refreshGroupControls()
    $('#toolbar-password').value = getPassword()
    $('#mail-limit').value = localStorage.getItem(CONFIG.MAIL_LIMIT_KEY) || '2'
    $('#per-page').value = String(state.itemsPerPage)
    renderTable()
    bindEvents()
    window.mailApp = { closeModal: closeAllModals }
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch(err => {
      console.error('Init failed:', err)
      showToast('初始化失败')
    })
  })
})()
