import {
	ActorData,
	ItemData,
	TokenData
} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs";
import PermissionPlayer from "./PermissionPlayer";
import Globals from "../Globals";
import CurrencyCalculator from "./systems/CurrencyCalculator";
import Dnd5eCurrencyCalculator from "./systems/Dnd5eCurrencyCalculator";
import MerchantSheet from "./MerchantSheet";
import SfrpgCurrencyCalculator from "./systems/SfrpgCurrencyCalculator";
import SwadeCurrencyCalculator from "./systems/SwadeCurrencyCalculator";
import Logger from "../Utils/Logger";
import Wfrp4eCurrencyCalculator from "./systems/Wfrp4eCurrencyCalculator";

let currencyCalculator: CurrencyCalculator;

class MerchantSheetNPCHelper {

	public static getElementById(elementId: string): HTMLInputElement {
		return <HTMLInputElement>document.getElementById(elementId);
	}

	public systemCurrencyCalculator(): CurrencyCalculator {
		if (currencyCalculator === null || currencyCalculator === undefined) {
			let currencyModuleImport = (<Game>game).system.id.charAt(0).toUpperCase() + (<Game>game).system.id.slice(1) + "CurrencyCalculator";
			Logger.Log("System currency to get: " + currencyModuleImport);
			if (currencyModuleImport === 'Dnd5eCurrencyCalculator') {
				currencyCalculator = new Dnd5eCurrencyCalculator();
				currencyCalculator.initSettings();
			} else if (currencyModuleImport === 'SfrpgCurrencyCalculator') {
				// @ts-ignore
				currencyCalculator = new SfrpgCurrencyCalculator();
				Logger.Log("Getting star finder", currencyCalculator);
				currencyCalculator.initSettings();
			} else if (currencyModuleImport === 'SwadeCurrencyCalculator') {
				currencyCalculator = new SwadeCurrencyCalculator();
				currencyCalculator.initSettings();
			} else if (currencyModuleImport === 'Wfrp4eCurrencyCalculator') {
				currencyCalculator = new Wfrp4eCurrencyCalculator();
				currencyCalculator.initSettings();
			} else {
				currencyCalculator = new CurrencyCalculator();
				currencyCalculator.initSettings();
			}
		}
		return currencyCalculator;
	}

	public getMerchantPermissionForPlayer(actorData: ActorData, player: PermissionPlayer): number {
		let defaultPermission = actorData.permission.default;
		if (player.data._id === null) {
			return 0;
		}
		if (player.data._id in actorData.permission) {
			// @ts-ignore
			return actorData.permission[player.data._id];
		}
		else if (typeof defaultPermission !== "undefined") {
			return defaultPermission;
		}

		return 0;
	}

	public getPermissionIcon(merchantPermission: number): string {
		const icons = {
			0: '<i class="far fa-circle"></i>',
			2: '<i class="fas fa-eye"></i>',
			999: '<i class="fas fa-users"></i>'
		};
		// @ts-ignore
		return icons[merchantPermission];
	}

	public getPermissionDescription(merchantPermission: number): string {
		const description  = {
			0: (<Game>game).i18n.localize("MERCHANTNPC.permission-none-help"),
			2: (<Game>game).i18n.localize("MERCHANTNPC.permission-observer-help"),
			999: (<Game>game).i18n.localize("MERCHANTNPC.permission-all-help")
		};
		// @ts-ignore
		return description[merchantPermission];
	}

	public updatePermissions(actorData: Actor, playerId: string, newLevel: number, event: JQuery.ClickEvent) {
		// Read player permission on this actor and adjust to new level
		console.log("Merchant sheet | _updatePermission ",actorData, playerId, newLevel, event)
		let currentPermissions = duplicate(actorData.data.permission);
		// @ts-ignore
		currentPermissions[playerId] = newLevel;
		// Save updated player permissions
		console.log("Merchant sheet | _updatePermission ",currentPermissions, actorData.data.permission)
		// @ts-ignore
		const merchantPermissions: PermissionControl = new PermissionControl(actorData.data);
		console.log("Merchant sheet | _updatePermission merchantPermissions",merchantPermissions)
		// @ts-ignore
		merchantPermissions._updateObject(event, currentPermissions);
	}

	public async changePrice(event: JQuery.ClickEvent, actor: Actor) {
		event.preventDefault();
		console.log("Merchant sheet | Change item price");
		let itemId = $(event.currentTarget).parents(".merchant-item").attr("data-item-id");

		// @ts-ignore
		const item: Item = actor.getEmbeddedDocument("Item", itemId);
		const template_file = "modules/"+Globals.ModuleName+"/templates/change_price.html";
		const template_data = { price: currencyCalculator.getPriceFromItem(item.data)};
		const rendered_html = await renderTemplate(template_file, template_data);

		let d = new Dialog({
			title: (<Game>game).i18n.localize('MERCHANTNPC.priceDialog-title'),
			content: rendered_html,
			buttons: {
				one: {
					icon: '<i class="fas fa-check"></i>',
					label: (<Game>game).i18n.localize('MERCHANTNPC.update'),
					callback: () => {
						// @ts-ignore
						item.update({[currencyCalculator.getPriceItemKey()]: currencyCalculator.getPrice(document.getElementById("price-value").value)});
					}
				},
				two: {
					icon: '<i class="fas fa-times"></i>',
					label: (<Game>game).i18n.localize('MERCHANTNPC.cancel'),
					callback: () => console.log("Merchant sheet | Change price Cancelled")
				}
			},
			default: "two",
			close: () => console.log("Merchant sheet | Change price Closed")
		});
		d.render(true);
	}

	public deleteItem(event: JQuery.ClickEvent, actor: Actor) {
		event.preventDefault();
		console.log("Merchant sheet | Delete Item clicked");
		let itemId: string;
		// @ts-ignore
		itemId = $(event.currentTarget).parents(".merchant-item").attr("data-item-id");
		actor.deleteEmbeddedDocuments("Item", [itemId]);
	}

	public onItemSummary(event: JQuery.ClickEvent, actor: Actor) {
		event.preventDefault();
		let li = $(event.currentTarget).parents(".merchant-item"),
			item = actor.items.get(li.data("item-id")),
			// @ts-ignore
			chatData = item.getChatData({secrets: actor.isOwner});
		// Toggle summary
		if ( li.hasClass("expanded") ) {
			let summary = li.children(".merchant-item-summary");
			summary.slideUp(200, () => summary.remove());
		} else {

			let div = $(`<div class="merchant-item-summary">${currencyCalculator.getDescription(chatData.description)}</div>`);
			li.append(div.hide());
			div.slideDown(200);
		}
		li.toggleClass("expanded");
	}


	public async changeQuantity(event: JQuery.ClickEvent, actor: Actor) {
		event.preventDefault();
		console.log("Merchant sheet | Change quantity");
		let itemId = $(event.currentTarget).parents(".merchant-item").attr("data-item-id");

		// @ts-ignore
		const item: Item = actor.getEmbeddedDocument("Item", itemId);
		const template_file = "modules/"+Globals.ModuleName+"/templates/change_quantity.html";
		// @ts-ignore
		const quantity = currencyCalculator.getQuantity(item.data.data.quantity);
		const infinityActivated = (quantity === Number.MAX_VALUE?'checked':'');
		// @ts-ignore
		const template_data = { quantity: quantity,
			infinity: infinityActivated
		};
		const rendered_html = await renderTemplate(template_file, template_data);
		let d = new Dialog({
			title: (<Game>game).i18n.localize('MERCHANTNPC.quantityDialog-title'),
			content: rendered_html,
			buttons: {
				one: {
					icon: '<i class="fas fa-check"></i>',
					label: (<Game>game).i18n.localize('MERCHANTNPC.update'),
					callback: () => {
						// @ts-ignore
						if (document.getElementById("quantity-infinity").checked) {

							actor.updateEmbeddedDocuments("Item",[{_id: itemId, [currencyCalculator.getQuantityKey()]: Number.MAX_VALUE}])
						} else {
							// @ts-ignore
							let newQuantity: number = document.getElementById("quantity-value").value;
							actor.updateEmbeddedDocuments("Item",[{
								_id: itemId,
								[currencyCalculator.getQuantityKey()]: newQuantity
							}])
						}
					}
				},
				two: {
					icon: '<i class="fas fa-times"></i>',
					label: (<Game>game).i18n.localize('MERCHANTNPC.cancel'),
					callback: () => console.log("Merchant sheet | Change quantity Cancelled")
				}
			},
			default: "two",
			close: () => console.log("Merchant sheet | Change quantity Closed")
		});
		d.render(true);
	}


	public async sellItem(target: Actor, dragSource: any, sourceActor: Actor, quantity: number, totalItemsPrice: number) {
		let sellerFunds = currencyCalculator.actorCurrency(sourceActor);
		currencyCalculator.addAmountForActor(sourceActor,sellerFunds,totalItemsPrice)
	}


	private async transaction(seller: Actor, buyer: Actor, itemId: string, quantity: number) {
		console.log(`Buying item: ${seller}, ${buyer}, ${itemId}, ${quantity}`);

		let sellItem = seller.getEmbeddedDocument("Item", itemId);
		// If the buyer attempts to buy more then what's in stock, buy all the stock.
		if (sellItem !== undefined && sellItem.data.data.quantity < quantity) {
			// @ts-ignore
			quantity = currencyCalculator.getQuantity(sellItem.data.data.quantity);
		}

		// On negative quantity we show an error
		if (quantity < 0) {
			this.errorMessageToActor(buyer, (<Game>game).i18n.localize("MERCHANTNPC.error-negativeAmountItems"));
			return;
		}

		// On 0 quantity skip everything to avoid error down the line
		if (quantity == 0) {
			return;
		}

		let sellerModifier = seller.getFlag(Globals.ModuleName, "priceModifier");
		let sellerStack = seller.getFlag(Globals.ModuleName, "stackModifier");
		if (sellerModifier === 'undefined') {
			sellerModifier = 1.0;
		}
		// @ts-ignore
		if (sellerStack !== undefined && quantity > sellerStack) quantity = sellerStack;

		// @ts-ignore
		let itemCostInGold = Math.round(currencyCalculator.getPriceFromItem(sellItem.data) * sellerModifier * 100) / 100;

		itemCostInGold *= quantity;
		let currency = currencyCalculator.actorCurrency(buyer);

		let buyerFunds = duplicate(currency);

		if (currencyCalculator.buyerHaveNotEnoughFunds(itemCostInGold,buyerFunds)) {
			this.errorMessageToActor(buyer, (<Game>game).i18n.localize("MERCHANTNPC.error-noFunds"));
			return;
		}

		currencyCalculator.subtractAmountFromActor(buyer,buyerFunds,itemCostInGold);
		let chatPrice = currencyCalculator.priceInText(itemCostInGold);
		let service = seller.getFlag(Globals.ModuleName, "service");
		if (!service) {
			// Update buyer's funds
			// @ts-ignore
			let keepItem: Boolean = seller.getFlag(Globals.ModuleName,"keepDepleted");
			Logger.Log("keepDepleted",keepItem)
			let moved = await helper.moveItems(seller, buyer, [{ itemId, quantity }],!keepItem);
			for (let m of moved) {
				this.chatMessage(
					seller, buyer,
					(<Game>game).i18n.format('MERCHANTNPC.buyText', {buyer: buyer.name, quantity: quantity, itemName: m.item.name, chatPrice: chatPrice}),
					m.item,false);
			}
		} else {
			// @ts-ignore
			this.chatMessage(seller, buyer, (<Game>game).i18n.format('MERCHANTNPC.buyText', {buyer: buyer.name, quantity: quantity, itemName: sellItem.name, chatPrice: chatPrice}), sellItem,service);
		}
	}

	private chatMessage(speaker: Actor, owner: Actor, message: string, item: Item, service: Boolean) {
		let image =  (service?'':'<div class= "merchant-item-image" style="background-image: url(${item.img})"></div>');
		if ((<Game>game).settings.get(Globals.ModuleName, "buyChat")) {
			message = `
            <div class="chat-card item-card" data-actor-id="${owner.id}" data-item-id="${item.id}">
                <header class="card-header flexrow">
            		${image}    
                    <h3 class="item-name">${item.name}</h3>
                </header>

                <div class="message-content">
                    <p>` + message + `</p>
                </div>
            </div>
            `;
			ChatMessage.create({
				// @ts-ignore
				user: (<Game>game).user.id,
				speaker: {
					// @ts-ignore
					actor: speaker,
					alias: speaker.name
				},
				content: message
			});
		}
	}

	public errorMessageToActor(target: Actor, message: string) {
		// let allowNoTargetGM = (<Game>game).settings.get(Globals.ModuleName, "allowNoGM")
		// if (allowNoTargetGM) {
			ui.notifications?.error(message);
		// } else {
		// 	// @ts-ignore
		// 	(<Game>game).socket.emit(Globals.Socket, {
		// 		type: "error",
		// 		targetId: target.id,
		// 		message: message
		// 	});
		// }
	}


	static buyTransactionFromPlayer(data: any) {
		console.log("Merchant sheet | buyTransaction ", data)
		if (data.type === "buy") {
			// @ts-ignore
			let buyer = (<Game>game).actors.get(data.buyerId);
			// @ts-ignore
			let seller = canvas.tokens.get(data.tokenId);

			if (buyer && seller && seller.actor) {
				helper.transaction(seller.actor, buyer, data.itemId, data.quantity);
			} else if (!seller) {
				ui.notifications?.error((<Game>game).i18n.localize("MERCHANTNPC.playerOtherScene"));
			}
		}
	}

	public async moveItems(source: Actor, destination: Actor, items: any[], deleteItemFromSource: Boolean) {
		const updates = [];
		const deletes = [];
		const additions = [];
		const destUpdates = [];
		const results = [];
		for (let i of items) {
			// @ts-ignore
			let itemId = i.itemId;
			// @ts-ignore
			let quantity = Number(i.quantity);
			let item = source.getEmbeddedDocument("Item", itemId);
			let infinity = source.getFlag(Globals.ModuleName,"infinity");
			// Move all items if we select more than the quantity.
			// @ts-ignore
			if (item !== undefined && currencyCalculator.getQuantity(item.data.data.quantity) < quantity) {
				// @ts-ignore
				quantity = Number(currencyCalculator.getQuantity(item.data.data.quantity));
			}

			let newItem = duplicate(item);
			// @ts-ignore
			const update = { _id: itemId, [currencyCalculator.getQuantityKey()]: currencyCalculator.getQuantity(item.data.data.quantity) >= Number.MAX_VALUE-10000 || infinity ? Number.MAX_VALUE : currencyCalculator.getQuantity(item.data.data.quantity) - quantity };
			let allowNoTargetGM = (<Game>game).settings.get(Globals.ModuleName, "allowNoGM")

			if (update[currencyCalculator.getQuantityKey()] === 0 && !allowNoTargetGM && deleteItemFromSource) {
				deletes.push(itemId);
			}
			else {
				updates.push(update);
			}
			currencyCalculator.setQuantityForItemData(newItem.data,quantity)
			results.push({
				item: newItem,
				quantity: quantity
			});
			let destItem = destination.data.items.find(i => i.name == newItem.name);
			if (destItem === undefined) {
				additions.push(newItem);
			} else {
				//console.log("Existing Item");
				// @ts-ignore
				currencyCalculator.setQuantityForItemData(destItem.data.data,Number(currencyCalculator.getQuantity(destItem.data.data.quantity)) + Number(currencyCalculator.getQuantity(newItem.data.quantity)))

				// @ts-ignore
				if (currencyCalculator.getQuantity(destItem.data.data.quantity) < 0) {
				// @ts-ignore
					currencyCalculator.setQuantityForItemData(destItem.data.data,0)
				}
				// @ts-ignore
				const destUpdate = { _id: destItem._id, [currencyCalculator.getQuantityKey()]: currencyCalculator.getQuantity(destItem.data.data.quantity) };
				destUpdates.push(destUpdate);
			}
		}

		if (deletes.length > 0) {

			await source.deleteEmbeddedDocuments("Item", deletes);
		}

		if (updates.length > 0) {
			await source.updateEmbeddedDocuments("Item", updates);
		}

		if (additions.length > 0) {
			await destination.createEmbeddedDocuments("Item", additions);
		}

		if (destUpdates.length > 0) {
			await destination.updateEmbeddedDocuments("Item", destUpdates);
		}

		return results;
	}

	public initModifiers(actor: Actor) {
		let priceModifier = actor.getFlag(Globals.ModuleName, "priceModifier");
		let sellModifier = actor.getFlag(Globals.ModuleName, "buyModifier");
		let sellerStack = actor.getFlag(Globals.ModuleName, "stackModifier");
		if (priceModifier === undefined) {
			actor.setFlag(Globals.ModuleName, "priceModifier", 1.0);
		}
		if (sellModifier === undefined) {
			actor.setFlag(Globals.ModuleName, "buyModifier", 0.5);
		}
		if (sellerStack === undefined) {
			actor.setFlag(Globals.ModuleName, "stackModifier", 20);
		}
		actor.render();
	}


}

let helper = new MerchantSheetNPCHelper();



export default MerchantSheetNPCHelper;