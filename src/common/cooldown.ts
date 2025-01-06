
export class Cooldown {
    private expires: {[key: string]: number} = {}
    private cooldownSeconds: number;

    constructor(cooldownSeconds: number) {
        this.cooldownSeconds = cooldownSeconds * 1000
    }

    onCooldown(value: string) {
        const now = Date.now()
        if (now < (this.expires[value] || 0))
            return true
        this.expires[value] = now + this.cooldownSeconds
        return false
    }
}