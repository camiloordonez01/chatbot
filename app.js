const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot')
const QRPortalWeb = require('@bot-whatsapp/portal')
const BaileysProvider = require('@bot-whatsapp/provider/baileys')
const MockAdapter = require('@bot-whatsapp/database/mock')

const textVolver = '▪️ *0* - Volver atrás'

let pedidos = {}

const main = async () => {
    const format = (value) =>
        value.toLocaleString('es-CO', {
            minimumFractionDigits: 0
        })

    const createSubMenuFlow = (submenuOptions, step) => {
        return submenuOptions.map((submenuOption) => {
            const { keyword, answer, price } = submenuOption

            return addKeyword([keyword]).addAnswer(
                'Digite la cantidad que desea:',
                { capture: true },
                async (ctx, { gotoFlow, flowDynamic, fallBack, state }) => {
                    if (isNaN(ctx.body)) {
                        await flowDynamic(`Debes ingresar un numero.`)
                        return fallBack()
                    }
                    const count = Number(ctx.body)
                    await state.update({ answer, price, count, step })
                    await gotoFlow(flowComentario)
                }
            )
        })
    }

    let nombre
    let telefono
    let direccion
    let pasoAnterior = 0

    const flowComentario = addKeyword(EVENTS.ACTION).addAnswer(
        'Algún comentario:',
        { capture: true },
        async (ctx, { gotoFlow, flowDynamic, state }) => {
            const { answer, price, count, step } = state.getMyState()

            await flowDynamic(`Has agregado (${count} und) ${answer} a tu pedido.`)
            pedidos = pedidos[answer]
                ? {
                      ...pedidos,
                      [answer]: {
                          count: pedidos[answer]['count'] + count,
                          price,
                          comment: ctx.body
                      }
                  }
                : {
                      ...pedidos,
                      [answer]: {
                          count,
                          price,
                          comment: ctx.body
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
        ['▪️ *0* - Volver atrás', '▪️ *1* - Volver al inicio', '▪️ *2* - Finalizar'],
        null,
        null,
        [flowInicio, flowAtras, flowFinalizar]
    )

    const flowHamburguesas = addKeyword(['1', 'hamburguesa', 'hambur', 'Hamburguesa']).addAnswer(
        ['▪️ *HAMBURGUESAS* ▪️', '▪️ *1* - Sencilla $12.500 ', '▪️ *2* - Especial $14.000 ', '▪️ *3* - Super $17.000 ', textVolver],
        null,
        null,
        [
            flowAtras,
            ...createSubMenuFlow(
                [
                    { keyword: '1', answer: 'Sencilla $12.500', price: 12500 },
                    { keyword: '2', answer: 'Especial $14.000', price: 14000 },
                    { keyword: '3', answer: 'Super $17.000', price: 17000 }
                ],
                1
            )
        ]
    )

    const flowPerros = addKeyword(['2', 'perros', 'perro', 'Perros']).addAnswer(
        [
            '▪️ *PERROS* ▪️',
            '▪️ *1* - Sencillo $12.000 ',
            '▪️ *2* - Especial $13.000 ',
            '▪️ *3* - Super $15.000 ',
            '▪️ *4* - Tocineta $15.000 ',
            '▪️ *5* - Choriperro $16.000 ',
            '▪️ *6* - Perro polka $16.000 ',
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

    const flowArepas = addKeyword(['3', 'arepas', 'arepa', 'Arepas']).addAnswer(
        ['▪️ *AREPAS* ▪️', '▪️ *1* - Santa rosana $10.000 ', '▪️ *2* - Arepa Burger $14.000 ', textVolver],
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

    const flowChuzos = addKeyword(['4', 'chuzos', 'chusos', 'chuzo']).addAnswer(
        ['▪️ *CHUZOS* ▪️', '▪️ *1* - De cerdo $12.000 ', '▪️ *2* - De pollo $12.000 ', '▪️ *2* - Polka $11.000 ', textVolver],
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
                4
            )
        ]
    )

    const flowAdicionales = addKeyword(['5', 'adicionales', 'adicional']).addAnswer(
        ['▪️ *ADICIONALES* ▪️', '▪️ *1* - Papas a la francesa $7.000 ', textVolver],
        null,
        null,
        [flowAtras, ...createSubMenuFlow([{ keyword: '1', answer: 'Papas a la francesa $7.000', price: 7000 }], 5)]
    )

    const flowBebidas = addKeyword(['6', 'bebidas', 'bebida']).addAnswer(
        [
            '▪️ *BEBIDAS* ▪️',
            '▪️ *1* - Gaseosa 350ml $4.000 ',
            '▪️ *2* - Gaseosa 1.5L $7.000 ',
            '▪️ *3* - Jugo HIT personal $4.000 ',
            '▪️ *4* - Jugo HIT litro $7.000 ',
            '▪️ *5* - Botella de agua $3.000 ',
            '▪️ *6* - Botella de agua con gas $3.000 ',
            '▪️ *7* - Gaseosa 400ml no retornable $4.500 ',
            '▪️ *8* - H2O $5.000 ',
            '▪️ *9* - Té $4.500 ',
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
                6
            )
        ]
    )

    const flowPedidoActual = addKeyword(['8', 'resumen', 'pedido']).addAction(async (ctx, { flowDynamic, gotoFlow }) => {
        if (Object.keys(pedidos).length == 0) {
            await flowDynamic('¡Nos ha agregado nada al pedido!')
            setTimeout(async () => {
                await gotoFlow(flowMenu)
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
            await gotoFlow(flowPedidoAdd)
        }
    })

    const flowMenu = addKeyword(EVENTS.ACTION).addAnswer(
        [
            ' ▪️ *Explosión de Sabores* ▪️',
            '',
            'Seleccione la opción que desea:',
            '▪️ *1* -  HAMBURGUESAS',
            '▪️ *2* -  PERROS',
            '▪️ *3* -  AREPAS',
            '▪️ *4* -  CHUZOS',
            '▪️ *5* -  ADICIONALES',
            '▪️ *6* -  BEBIDAS',
            '▪️ *8* -  PEDIDO ACTUAL',
            '▪️ *9* -  FINALIZAR'
        ],
        null,
        null,
        [
            flowHamburguesas,
            flowPerros,
            flowArepas,
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
            flowMetodoPago
        ]
    )

    const flowPrincipal = addKeyword(EVENTS.WELCOME)
        .addAnswer(
            '*Bienvenido a Burger Paisa*',
            {
                media: 'https://scontent.fpei3-1.fna.fbcdn.net/v/t39.30808-6/307176208_998578207703404_1571170339754293649_n.jpg?_nc_cat=111&ccb=1-7&_nc_sid=5f2048&_nc_eui2=AeGVfsGLwnODpP8j7Rwg2naG9kaz9zQSqrn2RrP3NBKqud1a23UQ2lH1Gspprt7CpRjxR7aiTny0C4sMM46227nw&_nc_ohc=oajeAxL3-DkAX_XnIYZ&_nc_ht=scontent.fpei3-1.fna&oh=00_AfC-tOlJHrLBcEoqjha0Qpi09GNqYqIPAkijHb_tZ1RXtw&oe=6533E4AA'
            },
            null,
            [flowMenu]
        )
        .addAction(async (ctx, { _, gotoFlow }) => {
            await gotoFlow(flowMenu)
        })

    const adapterDB = new MockAdapter()
    const adapterFlow = createFlow([flowPrincipal])
    const adapterProvider = createProvider(BaileysProvider)

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB
    })

    QRPortalWeb()
}

main()
