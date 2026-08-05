import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Lectura del buzón de la empresa por IMAP. Usa la misma contraseña de
// aplicación que enviar-correo, así no hace falta OAuth ni un proyecto en
// Google Cloud. Las librerías IMAP de Deno son inmaduras, así que el cliente va
// a mano: IMAP es un protocolo de líneas y solo se necesitan cuatro comandos.
const HOST = "imap.gmail.com"
const PORT = 993
const USER = "apexprodetailing0@gmail.com"
const READ_TIMEOUT_MS = 20000
// Tope de bytes al traer un mensaje completo: un correo con imágenes en base64
// puede pesar megas y solo interesa el texto.
const MAX_MENSAJE = 200000

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const encoder = new TextEncoder()
const decoder = new TextDecoder("utf-8", { fatal: false })

/** Respuesta del servidor: el texto completo y, aparte, los literales {n}. */
type Resp = { text: string; parts: string[] }

class Imap {
  #conn: Deno.TlsConn
  #buf = new Uint8Array(0)
  #tag = 0

  private constructor(conn: Deno.TlsConn) {
    this.#conn = conn
  }

  static async connect(): Promise<Imap> {
    const conn = await Deno.connectTls({ hostname: HOST, port: PORT })
    const client = new Imap(conn)
    await client.#readLine() // saludo del servidor
    return client
  }

  close() {
    try {
      this.#conn.close()
    } catch { /* ya cerrado */ }
  }

  async #fill() {
    const chunk = new Uint8Array(32 * 1024)
    const n = await Promise.race([
      this.#conn.read(chunk),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("el servidor de correo no respondió a tiempo")), READ_TIMEOUT_MS)
      ),
    ])
    if (n === null) throw new Error("el servidor de correo cerró la conexión")
    const merged = new Uint8Array(this.#buf.length + n)
    merged.set(this.#buf)
    merged.set(chunk.subarray(0, n), this.#buf.length)
    this.#buf = merged
  }

  async #readLine(): Promise<string> {
    for (;;) {
      for (let i = 0; i + 1 < this.#buf.length; i++) {
        if (this.#buf[i] === 13 && this.#buf[i + 1] === 10) {
          const line = decoder.decode(this.#buf.subarray(0, i))
          this.#buf = this.#buf.slice(i + 2)
          return line
        }
      }
      await this.#fill()
    }
  }

  async #readBytes(n: number): Promise<string> {
    while (this.#buf.length < n) await this.#fill()
    const out = decoder.decode(this.#buf.subarray(0, n))
    this.#buf = this.#buf.slice(n)
    return out
  }

  /** Ejecuta un comando y devuelve las respuestas hasta la línea etiquetada. */
  async exec(command: string, secreto = false): Promise<Resp[]> {
    const tag = `a${++this.#tag}`
    await this.#conn.write(encoder.encode(`${tag} ${command}\r\n`))

    const responses: Resp[] = []
    for (;;) {
      let line = await this.#readLine()
      const parts: string[] = [line]
      // Un literal {n} anuncia n bytes crudos que siguen a la línea.
      let literal = line.match(/\{(\d+)\}$/)
      while (literal) {
        const blob = await this.#readBytes(Number(literal[1]))
        const rest = await this.#readLine()
        parts.push(blob, rest)
        line += blob + rest
        literal = rest.match(/\{(\d+)\}$/)
      }
      responses.push({ text: line, parts })

      if (parts[0].startsWith(`${tag} `)) {
        const status = parts[0].slice(tag.length + 1).split(" ")[0]
        // Con secreto=true no se devuelve la línea: lleva eco del comando.
        if (status !== "OK") throw new Error(secreto ? `IMAP ${status}` : parts[0])
        return responses
      }
    }
  }

  async login(password: string) {
    // La contraseña de aplicación se muestra en grupos de cuatro; Gmail la
    // espera sin espacios.
    await this.exec(`LOGIN "${USER}" "${password.replace(/\s+/g, "")}"`, true)
  }
}

// ─── MIME ────────────────────────────────────────────────────────────────────

/** Decodifica cabeceras: =?UTF-8?B?...?= y =?UTF-8?Q?...?= */
function decodeHeader(value: string): string {
  return value
    .replace(/\?=\s+=\?/g, "?==?") // palabras codificadas contiguas
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, enc, text) => {
      try {
        const bytes = enc.toUpperCase() === "B"
          ? base64ABytes(text)
          : quotedPrintableABytes(String(text).replace(/_/g, " "))
        return new TextDecoder(String(charset).toLowerCase()).decode(bytes)
      } catch {
        return text
      }
    })
}

function base64ABytes(text: string): Uint8Array {
  const limpio = text.replace(/[^A-Za-z0-9+/=]/g, "")
  return Uint8Array.from(atob(limpio), (c) => c.charCodeAt(0))
}

function quotedPrintableABytes(text: string): Uint8Array {
  const sinCortes = text.replace(/=\r?\n/g, "") // saltos blandos
  const out: number[] = []
  for (let i = 0; i < sinCortes.length; i++) {
    const c = sinCortes[i]
    if (c === "=" && /^[0-9A-Fa-f]{2}$/.test(sinCortes.slice(i + 1, i + 3))) {
      out.push(parseInt(sinCortes.slice(i + 1, i + 3), 16))
      i += 2
    } else if (c.charCodeAt(0) < 128) {
      out.push(c.charCodeAt(0))
    } else {
      // Hay remitentes que dejan caracteres sin codificar dentro de un cuerpo
      // quoted-printable; ya vienen leídos como UTF-8, se devuelven a bytes.
      const caracter = String.fromCodePoint(sinCortes.codePointAt(i)!)
      out.push(...encoder.encode(caracter))
      i += caracter.length - 1
    }
  }
  return new Uint8Array(out)
}

function parseHeaders(blob: string): Record<string, string> {
  const headers: Record<string, string> = {}
  // Desdobla las líneas continuadas (empiezan con espacio o tabulación).
  const unfolded = blob.replace(/^\r?\n/, "").replace(/\r?\n[ \t]+/g, " ")
  for (const line of unfolded.split(/\r?\n/)) {
    const i = line.indexOf(":")
    if (i > 0) headers[line.slice(0, i).toLowerCase()] = decodeHeader(line.slice(i + 1).trim())
  }
  return headers
}

function charsetDe(contentType: string): string {
  return (contentType.match(/charset="?([^";]+)"?/i)?.[1] ?? "utf-8").toLowerCase()
}

function decodeCuerpo(body: string, encoding: string, charset: string): string {
  try {
    const enc = encoding.toLowerCase().trim()
    if (enc === "base64") return new TextDecoder(charset).decode(base64ABytes(body))
    if (enc === "quoted-printable") return new TextDecoder(charset).decode(quotedPrintableABytes(body))
  } catch { /* cae al texto tal cual */ }
  return body
}

function htmlAPlano(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Saca el texto legible de un cuerpo MIME, prefiriendo text/plain. */
function extraerTexto(headers: Record<string, string>, body: string): string {
  const contentType = headers["content-type"] ?? "text/plain"
  const encoding = headers["content-transfer-encoding"] ?? "7bit"

  if (/^multipart\//i.test(contentType)) {
    const boundary = contentType.match(/boundary="?([^";]+)"?/i)?.[1]
    if (!boundary) return decodeCuerpo(body, encoding, charsetDe(contentType))

    const piezas: { tipo: string; texto: string }[] = []
    for (const pieza of body.split(`--${boundary}`)) {
      const corte = pieza.search(/\r?\n\r?\n/)
      if (corte < 0) continue
      const h = parseHeaders(pieza.slice(0, corte))
      const cuerpo = pieza.slice(corte).replace(/^\r?\n\r?\n/, "")
      const tipo = h["content-type"] ?? "text/plain"
      // Los adjuntos no aportan texto.
      if (/attachment/i.test(h["content-disposition"] ?? "")) continue
      piezas.push({ tipo, texto: extraerTexto(h, cuerpo) })
    }
    const plano = piezas.find((p) => /text\/plain/i.test(p.tipo) && p.texto.trim())
    if (plano) return plano.texto
    return piezas.find((p) => p.texto.trim())?.texto ?? ""
  }

  const texto = decodeCuerpo(body, encoding, charsetDe(contentType))
  return /text\/html/i.test(contentType) ? htmlAPlano(texto) : texto.trim()
}

function parseRemitente(from: string): { nombre: string; email: string } {
  const conAngulos = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  if (conAngulos) {
    return { nombre: conAngulos[1].replace(/^"|"$/g, "").trim(), email: conAngulos[2].trim().toLowerCase() }
  }
  return { nombre: "", email: from.trim().toLowerCase() }
}

// ─── Endpoint ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    })

  let imap: Imap | null = null
  try {
    // El buzón es el de la empresa: solo administradores.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ error: "Sesión no válida." }, 401)
    const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (perfil?.role !== "admin") return json({ error: "Solo un administrador puede ver el buzón." }, 403)

    const password = Deno.env.get("GMAIL_APP_PASSWORD")
    if (!password) {
      return json({ error: "Falta el secreto GMAIL_APP_PASSWORD en el proyecto de Supabase." }, 500)
    }

    const { action = "lista", limit = 40, uid, uids, leido, respondido } = await req.json().catch(() => ({}))

    imap = await Imap.connect()
    await imap.login(password)
    const select = await imap.exec("SELECT INBOX")
    const exists = Number(
      select.map((r) => r.text.match(/^\* (\d+) EXISTS/)?.[1]).find(Boolean) ?? 0,
    )

    if (action === "lista") {
      const mensajes: unknown[] = []
      if (exists > 0) {
        const cuantos = Math.min(Math.max(Number(limit) || 40, 1), 100)
        const desde = Math.max(1, exists - cuantos + 1)
        const respuestas = await imap.exec(
          `FETCH ${desde}:${exists} (UID FLAGS BODY.PEEK[HEADER.FIELDS ` +
            `(FROM SUBJECT DATE MESSAGE-ID IN-REPLY-TO)])`,
        )
        for (const r of respuestas) {
          if (!/^\* \d+ FETCH/.test(r.parts[0])) continue
          const headers = parseHeaders(r.parts[1] ?? "")
          // Los índices pares son las líneas del protocolo; los impares, los
          // literales. UID y FLAGS pueden caer en cualquiera de las líneas.
          const meta = r.parts.filter((_, i) => i % 2 === 0).join(" ")
          mensajes.push({
            uid: Number(meta.match(/UID (\d+)/)?.[1] ?? 0),
            ...parseRemitente(headers["from"] ?? ""),
            asunto: headers["subject"] ?? "(sin asunto)",
            fecha: headers["date"] ?? "",
            messageId: headers["message-id"] ?? "",
            esRespuesta: !!headers["in-reply-to"],
            leido: /\\Seen/.test(meta),
            respondido: /\\Answered/.test(meta),
          })
        }
        mensajes.reverse() // el más reciente primero
      }
      return json({ ok: true, total: exists, mensajes })
    }

    if (action === "mensaje") {
      if (!uid) return json({ error: "Falta el identificador del mensaje." }, 400)
      const respuestas = await imap.exec(`UID FETCH ${Number(uid)} (BODY.PEEK[]<0.${MAX_MENSAJE}>)`)
      const item = respuestas.find((r) => /^\* \d+ FETCH/.test(r.parts[0]))
      if (!item || !item.parts[1]) return json({ error: "No se encontró el mensaje." }, 404)

      const crudo = item.parts[1]
      const corte = crudo.search(/\r?\n\r?\n/)
      const headers = parseHeaders(corte < 0 ? crudo : crudo.slice(0, corte))
      const cuerpo = corte < 0 ? "" : crudo.slice(corte).replace(/^\r?\n\r?\n/, "")

      return json({
        ok: true,
        mensaje: {
          uid: Number(uid),
          ...parseRemitente(headers["from"] ?? ""),
          asunto: headers["subject"] ?? "(sin asunto)",
          fecha: headers["date"] ?? "",
          messageId: headers["message-id"] ?? "",
          texto: extraerTexto(headers, cuerpo),
          truncado: crudo.length >= MAX_MENSAJE,
        },
      })
    }

    if (action === "marcar") {
      if (!uid) return json({ error: "Falta el identificador del mensaje." }, 400)
      const flags: string[] = []
      if (leido !== undefined) flags.push("\\Seen")
      if (respondido) flags.push("\\Answered")
      if (!flags.length) return json({ error: "Nada que marcar." }, 400)
      const signo = leido === false ? "-" : "+"
      await imap.exec(`UID STORE ${Number(uid)} ${signo}FLAGS (${flags.join(" ")})`)
      return json({ ok: true })
    }

    if (action === "eliminar") {
      const lista = uids ?? (uid ? [uid] : [])
      if (!lista.length) return json({ error: "Falta el identificador del mensaje." }, 400)
      for (const u of lista) {
        await imap.exec(`UID STORE ${Number(u)} +FLAGS (\\Deleted)`)
      }
      await imap.exec("EXPUNGE")
      return json({ ok: true, eliminados: lista.length })
    }

    return json({ error: `Acción desconocida: ${action}` }, 400)
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  } finally {
    imap?.close()
  }
})
