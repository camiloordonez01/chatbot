const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot')
const QRPortalWeb = require('@bot-whatsapp/portal')
const BaileysProvider = require('@bot-whatsapp/provider/baileys')
const MockAdapter = require('@bot-whatsapp/database/mock')

const textVolver = '*0* - ⬅️ Volver atrás'
const pedidoActual = '*9* - 📋 Ver pedido'
const mensajeAuxiliar = '\n_Por favor, responde con el número de la categoría que quieres agregar a tu pedido_'

let clientes = {}
let pedidos = {}

const main = async () => {
    const format = (value) =>
        value.toLocaleString('es-CO', {
            minimumFractionDigits: 0
        })

    const sesionExpirada = async (flowDynamic, gotoFlow) => {
        console.log('ENTRO SESSION')
        const date = new Date().getTime() / 1000

        const cliente = clientes[ctx.from]
        if (cliente && date > cliente + 60) {
            await flowDynamic('La conversación anterior expiro, volvamos a empezar.')

            clientes[ctx.from] = date
            return gotoFlow(flowSaludo)
        }
    }

    const createSubMenuFlow = (submenuOptions, step) => {
        return submenuOptions.map((submenuOption) => {
            const { keyword, item, categoria, price } = submenuOption

            return addKeyword([keyword]).addAnswer(
                `#️⃣ Cuantas ${categoria} ${item} deseas agregar a tu pedido: \n\n_Por favor responde solo con número_`,
                { capture: true },
                async (ctx, { gotoFlow, flowDynamic, fallBack, state }) => {
                    if (isNaN(ctx.body)) {
                        await flowDynamic(`🤭 Ups... debes ingresar un numero.`)
                        return fallBack()
                    }
                    const count = Number(ctx.body)
                    await state.update({ item, categoria, price, count, step })
                    await gotoFlow(flowComentario)
                }
            )
        })
    }

    let nombre
    let telefono
    let direccion
    let pasoAnterior = 0

    const flowComentario = addKeyword(EVENTS.ACTION)
        .addAction(async (_, {state, gotoFlow, flowDynamic}) => {
            const { item, categoria } = state.getMyState()
            await flowDynamic(`✍️ A continuación escribe un comentario para tu pedido de ${categoria} ${item}. \n\n_Si no tienes comentarios responde *NO*_`)
            await gotoFlow(flowComentario2)
        })

    const flowComentario2 = addKeyword(EVENTS.ACTION).addAction({ capture: true },
        async (ctx, { gotoFlow, flowDynamic, state }) => {
            const { answer, price, count, step } = state.getMyState()

            const comment = ctx.body === 'NO' ? '' : ctx.body

            await flowDynamic(`Has agregado (${count} und) ${answer} a tu pedido.`)
            pedidos = pedidos[answer]
                ? {
                      ...pedidos,
                      [answer]: {
                          count: pedidos[answer]['count'] + count,
                          price,
                          comment
                      }
                  }
                : {
                      ...pedidos,
                      [answer]: {
                          count,
                          price,
                          comment
                      }
                  }
            console.log(`Has agregado (${count} und) ${answer} a tu pedido.`)

            pasoAnterior = step
            await gotoFlow(flowPedidoAdd)
        }
    )

    const flowAtras = addKeyword(['0', 'volver', 'atras', 'atrás']).addAction(async (ctx, { _, gotoFlow }) => {
        switch (pasoAnterior) {
            case 0:
                await gotoFlow(flowMenu)
                break
            case 1:
                pasoAnterior = 1
                await gotoFlow(flowHamburguesas)
                break
            case 2:
                pasoAnterior = 1
                await gotoFlow(flowPerros)
                break
            case 3:
                pasoAnterior = 1
                await gotoFlow(flowArepas)
                break
            case 4:
                pasoAnterior = 1
                await gotoFlow(flowChuzos)
                break
            case 5:
                pasoAnterior = 1
                await gotoFlow(flowAdicionales)
                break
            default:
                await gotoFlow(flowMenu)
                break
        }
    })

    const flowInicio = addKeyword(['1', 'inicio', 'comenzar']).addAction(async (ctx, { _, gotoFlow }) => {
        pasoAnterior = 0
        await gotoFlow(flowMenu)
    })

    const flowFinalizar = addKeyword(['2', '9', 'finalizar', 'fin', 'terminar']).addAction(async (ctx, { flowDynamic, gotoFlow }) => {
        if (Object.keys(pedidos).length === 0) {
            await flowDynamic('¡Nos ha agregado nada al pedido!')

            setTimeout(async () => {
                await gotoFlow(flowMenu)
            }, 1000)
        } else {
            await gotoFlow(flowNombre)
        }
    })

    const flowNombre = addKeyword(EVENTS.ACTION).addAnswer(
        'Perfecto! \nPara finalizar necesitamos unos datos... \nEscriba su *Nombre*',
        { capture: true },
        async (ctx, { gotoFlow }) => {
            nombre = ctx.body
            await gotoFlow(flowDireccion)
        }
    )

    const flowDireccion = addKeyword(EVENTS.ACTION).addAnswer(
        `Por favor su *dirección* completa`,
        { capture: true },
        async (ctx, { gotoFlow }) => {
            direccion = ctx.body
            await gotoFlow(flowTelefono)
        }
    )

    const flowTelefono = addKeyword(EVENTS.ACTION).addAnswer('Su número de *teléfono*', { capture: true }, async (ctx, { gotoFlow }) => {
        telefono = ctx.body

        await gotoFlow(flowMetodoPago)
    })

    const flowMetodoPago = addKeyword(EVENTS.ACTION).addAnswer(
        `Por ultimo ¿Como desea pagar? ¿Devuelta de cuanto?`,
        { capture: true },
        async (ctx, { gotoFlow }) => {
            metodo = ctx.body
            await gotoFlow(flowFin)
        }
    )

    const flowFin = addKeyword(EVENTS.ACTION).addAnswer(`¡Estupendo!`, null, async (_, { flowDynamic, endFlow }) => {
        let total = 0

        let text = `*${nombre}*! te dejo el resumen de tu pedido \n`
        text += `- Nombre: *${nombre}*\n`
        text += `- Dirección: *${direccion}* \n`
        text += `- Teléfono: *${telefono}* \n\n`
        text += `*_Pedido seleccionado:_* \n`
        text += Object.keys(pedidos).map((key) => {
            const { count, price, comment } = pedidos[key]

            const priceFormat = format(price * count)

            total += price * count
            return `(${count} und) *${key}* | *_${comment}_*  -> $ ${priceFormat} \n`
        })
        text += '\n'
        text += `*TOTAL* $ ${format(total)}`

        await adapterProvider.sendText('573053919449@c.us', text)

        await flowDynamic(text)
        return endFlow(`Tu pedido a sido recibido, podría tardar entre 40 a 50 minutos. \n¡Fue un gusto atenderte!`)
    })

    const flowPedidoAdd = addKeyword(EVENTS.ACTION).addAnswer(
        ['*0* - Volver atrás', '*1* - Volver al inicio', '*2* - Finalizar'],
        null,
        null,
        [flowInicio, flowAtras, flowFinalizar]
    )

    const flowPedidoActual2 = addKeyword(['9', 'resumen', 'pedido']).addAction(async (ctx, { fallBack, flowDynamic, gotoFlow }) => {
        if (Object.keys(pedidos).length == 0) {
            await flowDynamic('¡Nos ha agregado nada al pedido!')
            setTimeout(async () => {
                await fallBack()
            }, 1000)
        } else {
            let total = 0
            let text = Object.keys(pedidos).map((key) => {
                const { count, price, comment } = pedidos[key]

                const priceFormat = format(price * count)

                total += price * count
                return `(${count} und) *${key}* | *_${comment}_* -> $ ${priceFormat} \n`
            })
            text += '\n'
            text += `*TOTAL* $ ${format(total)}`
            await flowDynamic(text)

            pasoAnterior = 0
            await fallBack()
        }
    })

    const flowHamburguesas = addKeyword(['1', 'hamburguesa', 'hambur', 'Hamburguesa']).addAnswer(
        [
            'Ahora, por favor selecciona que 🍔 *Hamburguesa* quieres agregar a tu pedido', 
            '*1* - 😋 _*SENCILLA*_ $12.500 \n_(Pan, carne, ensalada de la casa, tomate, queso, ripio de papa)_', 
            '*2* - 😁 _*ESPECIAL*_ $14.000 \n_(Pan, carne, *tocineta*, ensalada de la casa, tomate, queso, ripio de papa)_', 
            '*3* - 🤩 _*SUPER*_ $17.000 \n_(Pan, *Doble carne*, *Doble tocineta*, ensalada de la casa, tomate, *Doble queso*, ripio de papa)_',
            '*4* - 🤩 _*POLLO DESMECHADO*_ $17.000 \n_(Pan, *pollito despechado*, *tocineta*, ensalada de la casa, tomate, queso, ripio de papa)_',
            '*5* - 🤩 _*CARNE DESMECHADO*_ $17.000 \n_(Pan, *carne de res despechado*, *tocineta*, ensalada de la casa, tomate, *Doble queso*, ripio de papa)_',
            '*6* - ➕ 🧀 Adición de queso $4.000',
            '*7* - ➕ 🥩 Adición de carne $3.500',
            '*8* - ➕ 🥓 Adición de tocineta $3.000\n',
            '-----------------------------',
            pedidoActual,
            textVolver,
            mensajeAuxiliar,
        ],
        null,
        null,
        [
            flowAtras,
            flowPedidoActual2,
            ...createSubMenuFlow(
                [
                    { keyword: '1', item: '_*SENCILLA*_ $12.500', categoria: '🍔 Hamburguesa', price: 12500 },
                    { keyword: '2', item: '_*ESPECIAL*_ $14.000', categoria: '🍔 Hamburguesa', price: 14000 },
                    { keyword: '3', item: '_*SUPER*_ $17.000', categoria: '🍔 Hamburguesa', price: 17000 },
                    { keyword: '4', item: '_*POLLO DESMECHADO*_ $17.000', categoria: '🍔 Hamburguesa', price: 17000 },
                    { keyword: '5', item: '_*CARNE DESMECHADO*_ $17.000', categoria: '🍔 Hamburguesa', price: 17000 }
                ],
                1
            )
        ]
    )

    const flowPerros = addKeyword(['2', 'perros', 'perro', 'Perros']).addAnswer(
        [
            '🌭 *PERROS*',
            '*1* - Sencillo $12.000 ',
            '*2* - Especial $13.000 ',
            '*3* - Super $15.000 ',
            '*4* - Tocineta $15.000 ',
            '*5* - Choriperro $16.000 ',
            '*6* - Perro polka $16.000 ',
            textVolver
        ],
        null,
        null,
        [
            flowAtras,
            ...createSubMenuFlow(
                [
                    { keyword: '1', answer: 'Sencilla $12.000', price: 12000 },
                    { keyword: '2', answer: 'Especial $13.000', price: 13000 },
                    { keyword: '3', answer: 'Super $15.000', price: 15000 },
                    { keyword: '4', answer: 'Tocineta $15.000', price: 15000 },
                    { keyword: '5', answer: 'Choriperro $16.000', price: 16000 },
                    { keyword: '6', answer: 'Perro polka $16.000', price: 16000 }
                ],
                2
            )
        ]
    )

    const flowSalchipapa = addKeyword(['3', 'salchipapas', 'salchi', 'papa', 'papas']).addAnswer(
        ['🍟 *SALCHIPAPAS*', '*1* - Santa rosana $10.000 ', '*2* - Arepa Burger $14.000 ', textVolver],
        null,
        null,
        [
            flowAtras,
            ...createSubMenuFlow(
                [
                    { keyword: '1', answer: 'Santa rosana $10.000', price: 12000 },
                    { keyword: '2', answer: 'Arepa Burger $14.000', price: 14000 }
                ],
                3
            )
        ]
    )

    const flowArepas = addKeyword(['4', 'arepas', 'arepa', 'Arepas']).addAnswer(
        ['🫓 *AREPAS*', '*1* - Santa rosana $10.000 ', '*2* - Arepa Burger $14.000 ', textVolver],
        null,
        null,
        [
            flowAtras,
            ...createSubMenuFlow(
                [
                    { keyword: '1', answer: 'Santa rosana $10.000', price: 12000 },
                    { keyword: '2', answer: 'Arepa Burger $14.000', price: 14000 }
                ],
                4
            )
        ]
    )

    const flowChuzos = addKeyword(['5', 'chuzos', 'chusos', 'chuzo']).addAnswer(
        ['🥩 *CHUZOS*', '*1* - De cerdo $12.000 ', '*2* - De pollo $12.000 ', '*2* - Polka $11.000 ', textVolver],
        null,
        null,
        [
            flowAtras,
            ...createSubMenuFlow(
                [
                    { keyword: '1', answer: 'De cerdo $12.000', price: 12000 },
                    { keyword: '2', answer: 'De pollo $12.000', price: 12000 },
                    { keyword: '3', answer: 'Polka $11.000', price: 11000 }
                ],
                5
            )
        ]
    )

    const flowAdicionales = addKeyword(['6', 'fritas', 'papas fritas']).addAnswer(
        ['🍟 *PAPITAS FRITAS Y MAS* ▪️', '*1* - Papas a la francesa $7.000 ', textVolver],
        null,
        null,
        [flowAtras, ...createSubMenuFlow([{ keyword: '1', answer: 'Papas a la francesa $7.000', price: 7000 }], 6)]
    )

    const flowBebidas = addKeyword(['7', 'bebidas', 'bebida']).addAnswer(
        [
            '🥤 *BEBIDAS* ▪️',
            '*1* - Gaseosa 350ml $4.000 ',
            '*2* - Gaseosa 1.5L $7.000 ',
            '*3* - Jugo HIT personal $4.000 ',
            '*4* - Jugo HIT litro $7.000 ',
            '*5* - Botella de agua $3.000 ',
            '*6* - Botella de agua con gas $3.000 ',
            '*7* - Gaseosa 400ml no retornable $4.500 ',
            '*8* - H2O $5.000 ',
            '*9* - Té $4.500 ',
            textVolver
        ],
        null,
        null,
        [
            flowAtras,
            ...createSubMenuFlow(
                [
                    { keyword: '1', answer: 'Gaseosa 350ml $4.000', price: 4000 },
                    { keyword: '2', answer: 'Gaseosa 1.5L $7.000', price: 7000 },
                    { keyword: '3', answer: 'Jugo HIT personal $4.000', price: 4000 },
                    { keyword: '4', answer: 'Jugo HIT litro $7.000', price: 7000 },
                    { keyword: '5', answer: 'Botella de agua $3.000', price: 3000 },
                    { keyword: '6', answer: 'Botella de agua con gas $3.000', price: 3000 },
                    { keyword: '7', answer: 'Gaseosa 400ml no retornable $4.500', price: 4500 },
                    { keyword: '8', answer: 'H2O $5.000', price: 5000 },
                    { keyword: '9', answer: 'Té $4.500', price: 4500 }
                ],
                7
            )
        ]
    )
    const flowPedidoActual = addKeyword(['8', 'resumen', 'pedido']).addAction(async (ctx, { fallBack, flowDynamic, gotoFlow }) => {
        if (Object.keys(pedidos).length == 0) {
            await flowDynamic('¡Nos ha agregado nada al pedido!')
            setTimeout(async () => {
                await fallBack()
            }, 1000)
        } else {
            let total = 0
            let text = Object.keys(pedidos).map((key) => {
                const { count, price, comment } = pedidos[key]

                const priceFormat = format(price * count)

                total += price * count
                return `(${count} und) *${key}* | *_${comment}_* -> $ ${priceFormat} \n`
            })
            text += '\n'
            text += `*TOTAL* $ ${format(total)}`
            await flowDynamic(text)

            pasoAnterior = 0
            await fallBack()
        }
    })

    const flowMenu = addKeyword(EVENTS.ACTION).addAnswer(
        `¡Perfecto! A continuación, te presento las categorías de nuestros productos.
            
Seleccione la opción que desea:
1 - 🍔 HAMBURGUESAS
2 - 🌭 PERROS
3 - 🍟 SALCHIPAPAS
4 - 🫓 AREPAS
5 - 🥩 CHUZOS 
6 - 🍟 PAPITAS FRITAS Y MAS
7 - 🥤 BEBIDAS

------------------------------------
8 -  📋 PEDIDO ACTUAL
9 -  ✅ FINALIZAR

Por favor, responde el número de la categoría que quieres pedir`,
        null,
        null,
        [
            flowHamburguesas,
            flowPerros,
            flowArepas,
            flowSalchipapa,
            flowChuzos,
            flowAdicionales,
            flowBebidas,
            flowInicio,
            flowAtras,
            flowFinalizar,
            flowNombre,
            flowDireccion,
            flowTelefono,
            flowFin,
            flowPedidoActual,
            flowComentario,
            flowComentario2,
            flowMetodoPago
        ]
    )

    const flowPedido = addKeyword(['1', 'pedido'])
        .addAnswer(
            '*Bienvenido a Burger Paisa*',
            {
                media: './MENU.pdf'
            },
            null,
            [flowMenu]
        )
        .addAction(async (ctx, { gotoFlow }) => {
            await gotoFlow(flowMenu)
        })

    const flowServicioCliente = addKeyword(['2', 'servicio', 'cliente'])
        .addAnswer([
            'Perfecto, en un momento un asesor continuará con la conversación.\n',
            '_Si quieres regresar y hacer el pedido escribe la palabra *pedido*._'
        ])
        .addAction(async (ctx, { _, endFlow }) => {
            return endFlow()
        })

    const flowSaludo = addKeyword(EVENTS.ACTION).addAnswer(
        [
            '¡Bienvenido a Burger Paisa! 😊🍔',
            '¿En qué puedo ayudarte hoy? A continuación selecciona que deseas hacer.\n',
            '*1* - Hacer un pedido',
            '*2* - Hablar con servicio al cliente\n',
            '_Por favor responde con el número de la opción que deseas._'
        ],
        null,
        null,
        [flowPedido, flowServicioCliente]
    )

    const flowInicial = addKeyword(EVENTS.WELCOME).addAction(async (ctx, { _, gotoFlow, flowDynamic, endFlow }) => {
        const date = new Date().getTime() / 1000

        const cliente = clientes[ctx.from]
        if (cliente && date <= cliente + 60) {
            if (['hola', 'Hola', 'pedido', 'iniciar', 'buenas', 'saludos', 'comenzar', '¡hola!', 'quiero'].includes(ctx.body)) {
                return gotoFlow(flowSaludo)
            }
            return endFlow()
        } else if (cliente && date > cliente + 60) {
            await flowDynamic('La conversación anterior expiro, volvamos a empezar.')
            return gotoFlow(flowSaludo)
        } else {
            clientes[ctx.from] = date
            return gotoFlow(flowSaludo)
        }
    })

    const adapterDB = new MockAdapter()
    const adapterFlow = createFlow([flowInicial, flowSaludo])
    const adapterProvider = createProvider(BaileysProvider)

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB
    })

    QRPortalWeb()
}

main()
