import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useDistricts } from '../../api/districts'
import { messageFor } from '../../api/errors'
import { useSessionUser } from '../../api/session'
import { useTransitLines, useTransitStops, useTransitStopsDepartures } from '../../api/transit'
import { LineBadge } from '../../features/transit/LineBadge'
import { LineSheet } from '../../features/transit/LineSheet'
import { NetworkStatus } from '../../features/transit/NetworkStatus'
import { StopDepartures } from '../../features/transit/StopDepartures'
import styles from '../../features/transit/Transit.module.css'
import { useFavoriteStops } from '../../features/transit/useFavoriteStops'
import { defineMessages, useMessages } from '../../i18n'
import { ButtonRouteLink } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { GlassPanel } from '../../ui/GlassPanel'
import { RowButton } from '../../ui/Rows'
import text from '../../ui/text.module.css'
import { ConsolePage } from '../Console/ConsolePage'

const messages = defineMessages(
  {
    title: 'Transports',
    lead: 'L’état du réseau, les prochains départs à vos arrêts et les horaires de chaque ligne, sur un seul écran. Mis à jour chaque minute.',
    network: 'État du réseau',
    nearMe: 'Prochains départs près de chez moi',
    district: 'Quartier',
    pickDistrict: 'Choisir un quartier',
    clearChosen: 'Retirer l’arrêt recherché',
    loginFavorites: 'Connectez-vous pour enregistrer vos arrêts favoris : ils s’afficheront en premier.',
    noStops: 'Aucun arrêt dans ce quartier.',
    pickOrSearch: 'Choisissez votre quartier ou cherchez un arrêt pour voir les prochains départs.',
    searchedStop: 'Arrêt recherché',
    myStop: 'Mon arrêt',
    searchTitle: 'Chercher un arrêt ou une ligne',
    searchLabel: 'Nom de l’arrêt, de la ligne ou de la rue',
    searchPlaceholder: 'Ex. Grand Dôme, T1',
    noMatch: 'Aucun arrêt ni ligne ne correspond.',
    results: 'Résultats',
    seeLine: 'Voir la ligne',
    nextDepartures: 'Prochains départs',
    back: 'Retour à l’accueil',
  },
  {
    title: 'Transport',
    lead: 'Network status, the next departures at your stops and each line’s timetable, on one screen. Updated every minute.',
    network: 'Network status',
    nearMe: 'Next departures near me',
    district: 'District',
    pickDistrict: 'Choose a district',
    clearChosen: 'Remove the searched stop',
    loginFavorites: 'Sign in to save your favourite stops: they will show first.',
    noStops: 'No stop in this district.',
    pickOrSearch: 'Choose your district or search for a stop to see the next departures.',
    searchedStop: 'Searched stop',
    myStop: 'My stop',
    searchTitle: 'Search for a stop or a line',
    searchLabel: 'Stop name, line or street',
    searchPlaceholder: 'e.g. Grand Dome, T1',
    noMatch: 'No stop or line matches.',
    results: 'Results',
    seeLine: 'See the line',
    nextDepartures: 'Next departures',
    back: 'Back to home',
  },
)

/**
 * F36: municipal transport on one screen. Network status, the next departures at the resident's stops
 * (chosen stop, favourites, then their district's) and the search; a line opens on the same screen (`?ligne=`).
 * The state lives in the URL: ?ligne=T1, ?arret=<id>, ?quartier=<id>, ?q=.
 */
export default function TransportsPage() {
  const [params, setParams] = useSearchParams()
  const user = useSessionUser()
  const favorites = useFavoriteStops()
  const districts = useDistricts()
  const m = useMessages(messages)

  const lineCode = params.get('ligne')?.toUpperCase() || undefined
  const chosenStop = Number(params.get('arret')) || undefined
  const districtId = Number(params.get('quartier')) || user?.district_id || undefined
  const q = params.get('q') ?? ''
  const [search, setSearch] = useState(q)

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )

  useEffect(() => {
    if (search.trim() === q) return
    const timer = setTimeout(() => update({ q: search.trim() || null }), 300)
    return () => clearTimeout(timer)
    // the typed text is the only trigger; update is recreated every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const openLine = (code: string) => update({ ligne: code })
  const openStop = (id: number) => {
    update({ arret: String(id) })
    document.getElementById('mes-arrets')?.scrollIntoView({ block: 'start' })
  }

  // my stops: the one picked in the search, then favourites, then the district's, without duplicates
  const districtStops = useTransitStops({ district_id: districtId }, districtId !== undefined)
  const stopIds = [...new Set([chosenStop, ...favorites.ids, ...(districtStops.data ?? []).map((stop) => stop.id)])].filter(
    (id): id is number => id !== undefined,
  )
  const departures = useTransitStopsDepartures(stopIds)
  const tagOf = (id: number) => (id === chosenStop ? m.searchedStop : favorites.ids.includes(id) ? m.myStop : undefined)

  const lines = useTransitLines()
  const stopResults = useTransitStops({ q }, q.length > 0)
  const needle = q.toLowerCase()
  const lineResults = q ? (lines.data ?? []).filter((line) => line.code.toLowerCase().includes(needle) || line.name.toLowerCase().includes(needle)) : []

  return (
    <ConsolePage title={m.title} lead={m.lead}>
      {lineCode && <LineSheet key={lineCode} code={lineCode} onClose={() => update({ ligne: null })} />}

      <section className={styles.section} aria-labelledby="reseau">
        <h2 id="reseau">{m.network}</h2>
        <NetworkStatus onOpenLine={openLine} />
      </section>

      <section className={styles.section} aria-labelledby="mes-arrets">
        <h2 id="mes-arrets">{m.nearMe}</h2>
        <div className={styles.toolbar}>
          <div className={styles.grow}>
            <Field label={m.district} htmlFor="transport-quartier">
              <select id="transport-quartier" value={districtId ?? ''} onChange={(event) => update({ quartier: event.target.value || null })}>
                <option value="">{m.pickDistrict}</option>
                {districts.data?.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {chosenStop && (
            <button type="button" className={styles.textButton} onClick={() => update({ arret: null })}>
              {m.clearChosen}
            </button>
          )}
        </div>
        {!favorites.canSave && <p className={text.note}>{m.loginFavorites}</p>}
        {favorites.error && <p className={text.error}>{messageFor(favorites.error)}</p>}
        {districtStops.isError && <p className={text.error}>{messageFor(districtStops.error)}</p>}

        {stopIds.length === 0 ? (
          <GlassPanel>
            <p>{districtId ? m.noStops : m.pickOrSearch}</p>
          </GlassPanel>
        ) : (
          <div className={styles.stops}>
            {stopIds.map((id, index) => (
              <StopDepartures
                key={id}
                query={departures[index]}
                tag={tagOf(id)}
                onOpenLine={openLine}
                favorite={
                  favorites.canSave
                    ? { active: favorites.ids.includes(id), disabled: favorites.saving, onToggle: () => favorites.toggle(id) }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="chercher">
        <h2 id="chercher">{m.searchTitle}</h2>
        <Field label={m.searchLabel} htmlFor="transport-q">
          <input id="transport-q" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={m.searchPlaceholder} />
        </Field>
        {stopResults.isError && <p className={text.error}>{messageFor(stopResults.error)}</p>}
        {q && stopResults.data && lineResults.length === 0 && stopResults.data.length === 0 && <p className={text.note}>{m.noMatch}</p>}
        {(lineResults.length > 0 || (!!q && !!stopResults.data?.length)) && (
          <ul className={styles.results} aria-label={m.results}>
            {lineResults.map((line) => (
              <li key={`line-${line.id}`}>
                <RowButton onClick={() => openLine(line.code)}>
                  <LineBadge line={line} />
                  <small>{m.seeLine}</small>
                </RowButton>
              </li>
            ))}
            {q &&
              stopResults.data?.map((stop) => (
                <li key={`stop-${stop.id}`}>
                  <RowButton onClick={() => openStop(stop.id)}>
                    <span>
                      <strong>{stop.name}</strong>
                      <small>
                        {[stop.district?.name, stop.lines.map((line) => line.code).join(', ')].filter(Boolean).join(' · ')}
                      </small>
                    </span>
                    <small>{m.nextDepartures}</small>
                  </RowButton>
                </li>
              ))}
          </ul>
        )}
        {!q && lines.data && (
          <div className={styles.lineLinks}>
            {lines.data.map((line) => (
              <button key={line.id} type="button" className={styles.lineChip} onClick={() => openLine(line.code)}>
                <LineBadge line={line} />
              </button>
            ))}
          </div>
        )}
      </section>

      <div>
        <ButtonRouteLink to="/ville" variant="ghost" small>
          {m.back}
        </ButtonRouteLink>
      </div>
    </ConsolePage>
  )
}
